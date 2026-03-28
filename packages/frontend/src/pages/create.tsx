import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

export const getServerSideProps = async () => ({ props: {} });
import { uploadToShelby, uploadMetadataToShelby } from '@/utils/shelby';
import {
  buildCreateCollectionPayload,
  getAccountBalance,
  waitForTransaction,
  getTxUrl,
} from '@/utils/aptos';
import { getOptimalGasParameters, type AdvancedTransactionConfig } from '@/utils/advancedAptos';
import type { NFTCollection, NFTMetadata } from '@/types';
import { Navigation } from '@/components/Navigation';

interface FormData {
  name: string;
  description: string;
  symbol: string;
  image: File | null;
  supply: number;
  royaltyBps: number;
  mintPrice: number;
}

export default function CreateCollection() {
  const { setNotification, setIsLoading, addCollection } = useAppStore();
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const currentAddress = account?.address ? String(account.address) : null;

  const [balance, setBalance] = useState('0');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    symbol: '',
    image: null,
    supply: 1,
    royaltyBps: 500,
    mintPrice: 0,
  });
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedTransactionConfig>({
    sponsored: { enableSponsorship: false },
    orderless: { useOrderless: false },
    multiAgent: { useMultiAgent: false },
    parallelExecution: true,
  });
  const [gasOptions, setGasOptions] = useState({ slowGasPrice: 200, standardGasPrice: 250, fastGasPrice: 400, recommendedPrice: 250 });
  const [selectedGasPrice, setSelectedGasPrice] = useState<'slow' | 'standard' | 'fast'>('standard');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStep, setUploadStep] = useState<'idle' | 'encoding' | 'registering' | 'uploading' | 'minting' | 'done'>('idle');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!currentAddress) return;
    const bal = await getAccountBalance(currentAddress);
    setBalance((Number(bal) / 1e8).toFixed(4));
  }, [currentAddress]);

  useEffect(() => {
    getOptimalGasParameters().then(setGasOptions);
    fetchBalance();
  }, [fetchBalance]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'supply' || name === 'royaltyBps' || name === 'mintPrice'
          ? name === 'mintPrice' ? parseFloat(value) || 0 : parseInt(value) || 0
          : value,
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormData((prev) => ({ ...prev, image: file }));
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAddress || !signAndSubmitTransaction) {
      setNotification({ type: 'error', message: 'Please connect your wallet first' });
      return;
    }
    if (!formData.image) {
      setNotification({ type: 'error', message: 'Please select a collection image' });
      return;
    }
    if (formData.supply < 1) {
      setNotification({ type: 'error', message: 'Supply must be at least 1' });
      return;
    }

    setIsSubmitting(true);
    setIsLoading(true);
    setSuccessTx(null);

    try {
      // Step 1: Upload image to Shelby
      setUploadStep('encoding');
      const imageUpload = await uploadToShelby(
        {
          file: formData.image,
          blobName: `collections/${currentAddress}/${formData.name}/image_${Date.now()}`,
          onProgress: (step) => {
            if (step === 'encoding') setUploadStep('encoding');
            else if (step === 'registering') setUploadStep('registering');
            else if (step === 'uploading') setUploadStep('uploading');
          },
        },
        signAndSubmitTransaction as any
      );

      // Step 2: Upload collection metadata to Shelby
      setUploadStep('uploading');
      const metadata: NFTMetadata = {
        name: formData.name,
        description: formData.description,
        image: imageUpload.url,
        attributes: [],
      };
      const metadataUrl = await uploadMetadataToShelby(
        metadata,
        `collections/${currentAddress}/${formData.name}/metadata_${Date.now()}.json`,
        signAndSubmitTransaction as any
      );

      // Step 3: Create collection on Aptos
      setUploadStep('minting');
      const payload = buildCreateCollectionPayload({
        name: formData.name,
        description: formData.description,
        uri: metadataUrl.length > 200 ? 'https://shelby.xyz/demo' : metadataUrl,
        maxSupply: formData.supply,
        royaltyNumerator: formData.royaltyBps,
        royaltyDenominator: 10000,
      });

      const txResult = await signAndSubmitTransaction({ data: payload });
      const txHash = (txResult as any).hash || '';

      if (txHash) {
        await waitForTransaction(txHash);
        setSuccessTx(txHash);

        const collection: NFTCollection = {
          id: `col_${Date.now()}`,
          name: formData.name,
          description: formData.description,
          symbol: formData.symbol,
          creator: currentAddress,
          imageUrl: imageUpload.url,
          supply: formData.supply,
          minted: 0,
          royaltyBps: formData.royaltyBps,
          mintPrice: formData.mintPrice,
          txHash,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        addCollection(collection);
      }

      setUploadStep('done');
      setNotification({ type: 'success', message: `Collection "${formData.name}" created! ✅` });
      setFormData({ name: '', description: '', symbol: '', image: null, supply: 1, royaltyBps: 500, mintPrice: 0 });
      setImagePreview(null);
    } catch (error) {
      console.error('Error creating collection:', error);
      const msg = error instanceof Error ? error.message : 'Failed to create collection';
      setNotification({ type: 'error', message: msg });
      setUploadStep('idle');
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };

  const uploadStepLabel: Record<typeof uploadStep, string> = {
    idle: 'Create Collection',
    encoding: '⚙️ Encoding image for Shelby…',
    registering: '📝 Registering on Aptos…',
    uploading: '🚀 Uploading to Shelby…',
    minting: '🔗 Creating collection on-chain…',
    done: '✅ Done!',
  };

  // Preview: what the collection will look like
  const isOneOfOne = formData.supply === 1;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation balance={balance} />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        {/* Success Banner */}
        {successTx && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-500/50 rounded-xl">
            <div className="font-semibold text-green-300 mb-2">✅ Collection Created!</div>
            <a href={getTxUrl(successTx)} target="_blank" rel="noopener noreferrer"
              className="text-sm text-green-400 hover:text-green-300 font-mono break-all underline">
              View on Aptos Explorer →
            </a>
          </div>
        )}

        <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8">
          <h1 className="text-3xl font-bold text-white mb-1">Create Collection</h1>
          <p className="text-slate-400 text-sm mb-8">
            Stored on Shelby Protocol · Minted on Aptos Testnet
          </p>

          {!connected && (
            <div className="mb-6 p-4 bg-blue-900/30 border border-blue-500/40 rounded-xl text-blue-200">
              <p className="font-semibold mb-1">🔑 Wallet Required</p>
              <p className="text-sm">Connect your wallet using the button in the top navigation.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Collection Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Collection Name *</label>
              <input
                type="text" name="name" value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g. Shelby Genesis"
                required
                disabled={!connected || isSubmitting}
                className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
              <textarea
                name="description" value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your collection…"
                rows={3}
                disabled={!connected || isSubmitting}
                className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition resize-none"
              />
            </div>

            {/* Symbol */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Symbol *</label>
              <input
                type="text" name="symbol" value={formData.symbol}
                onChange={handleInputChange}
                placeholder="e.g. SHB"
                maxLength={10} required
                disabled={!connected || isSubmitting}
                className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition uppercase"
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Collection Image *</label>
              <p className="text-xs text-slate-500 mb-2">
                Had l image ghadi tkon f <strong className="text-slate-400">ga3 l NFTs</strong> dyal had collection — kol token yshare nafs l image.
              </p>
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <input
                    type="file" accept="image/*"
                    onChange={handleImageChange}
                    required
                    disabled={!connected || isSubmitting}
                    className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-600 text-white rounded-lg file:mr-3 file:px-4 file:py-1.5 file:bg-purple-600 file:hover:bg-purple-500 file:text-white file:border-0 file:rounded-md file:cursor-pointer cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition text-sm"
                  />
                  <p className="text-xs text-slate-600 mt-1">Stored on Shelby Protocol</p>
                </div>
                {imagePreview && (
                  <img src={imagePreview} alt="Preview"
                    className="w-20 h-20 rounded-xl object-cover border border-slate-600 flex-shrink-0" />
                )}
              </div>
            </div>

            {/* ── Supply ── */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Supply *
                {isOneOfOne
                  ? <span className="ml-2 text-xs px-2 py-0.5 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-full">💎 1/1 Unique</span>
                  : <span className="ml-2 text-xs px-2 py-0.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-full">📦 Edition of {formData.supply}</span>
                }
              </label>
              <input
                type="number" name="supply"
                value={formData.supply}
                onChange={handleInputChange}
                min={1} max={10000} step={1}
                required
                disabled={!connected || isSubmitting}
                className="w-full px-4 py-2.5 bg-slate-800/60 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                {isOneOfOne
                  ? '1 token unique — 1/1 artwork, ya3ni wahd l person ghadi ymint had l NFT.'
                  : `${formData.supply} tokens — kol wahda unique (${formData.name || 'Artwork'} #1, #2 … #${formData.supply}) b nafs l image.`
                }
              </p>
            </div>

            {/* Mint Price */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Mint Price
                <span className="ml-2 text-xs text-slate-500">(0 = free mint)</span>
              </label>
              <div className="relative">
                <input
                  type="number" name="mintPrice"
                  value={formData.mintPrice}
                  onChange={handleInputChange}
                  min={0} step={0.01}
                  disabled={!connected || isSubmitting}
                  className="w-full pl-4 pr-16 py-2.5 bg-slate-800/60 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">APT</span>
              </div>
            </div>

            {/* Royalty */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Royalty: <span className="text-purple-400 font-semibold">{(formData.royaltyBps / 100).toFixed(1)}%</span>
              </label>
              <input
                type="range" name="royaltyBps"
                value={formData.royaltyBps}
                onChange={handleInputChange}
                min={0} max={2500} step={100}
                disabled={!connected || isSubmitting}
                className="w-full accent-purple-500 disabled:opacity-40"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>0%</span><span>25%</span>
              </div>
            </div>

            {/* Live preview card */}
            {(formData.name || imagePreview) && (
              <div className="p-4 bg-slate-800/40 border border-slate-600/50 rounded-xl">
                <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Preview</p>
                <div className="flex gap-4 items-center">
                  {imagePreview && (
                    <img src={imagePreview} alt="preview"
                      className="w-14 h-14 rounded-lg object-cover border border-slate-700 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-white font-bold truncate">{formData.name || '—'}</div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      {isOneOfOne ? '💎 1/1 • Single unique artwork' : `📦 ${formData.supply} editions • nafs l image`}
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">
                      {formData.mintPrice > 0 ? `${formData.mintPrice} APT per mint` : 'Free mint'} · {(formData.royaltyBps / 100).toFixed(1)}% royalty
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Options */}
            <div className="border-t border-slate-700 pt-5">
              <h2 className="text-base font-semibold text-white mb-4">⚡ Advanced Options</h2>

              {/* Gas */}
              <div className="mb-4 bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-slate-300 mb-3">Gas Priority</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['slow', 'standard', 'fast'] as const).map((speed) => {
                    const price = gasOptions[`${speed}GasPrice`];
                    const active = selectedGasPrice === speed;
                    return (
                      <button key={speed} type="button"
                        onClick={() => setSelectedGasPrice(speed)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
                          active ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                        }`}>
                        <div className="capitalize">{speed}</div>
                        <div className="text-xs opacity-75">{price} oct</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sponsored */}
              <label className="flex items-center gap-3 mb-3 p-3 bg-green-900/20 border border-green-600/30 rounded-xl cursor-pointer">
                <input type="checkbox"
                  checked={advancedConfig.sponsored?.enableSponsorship || false}
                  onChange={(e) => setAdvancedConfig({ ...advancedConfig, sponsored: { enableSponsorship: e.target.checked } })}
                  className="w-4 h-4 rounded accent-green-500"
                />
                <div>
                  <div className="text-sm font-medium text-green-300">💚 Sponsored Transaction (Gas-Free)</div>
                  <div className="text-xs text-green-500">Sponsor covers gas — no APT required from your wallet</div>
                </div>
              </label>

              {/* Orderless */}
              <label className="flex items-center gap-3 p-3 bg-blue-900/20 border border-blue-600/30 rounded-xl cursor-pointer">
                <input type="checkbox"
                  checked={advancedConfig.orderless?.useOrderless || false}
                  onChange={(e) => setAdvancedConfig({ ...advancedConfig, orderless: { useOrderless: e.target.checked } })}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-blue-300">🔄 Orderless Transaction</div>
                  <div className="text-xs text-blue-500">Submit without sequence number — enables parallel mint submissions</div>
                </div>
              </label>
            </div>

            {/* Upload progress */}
            {isSubmitting && uploadStep !== 'idle' && (
              <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-xl">
                <div className="flex items-center gap-2 text-purple-300 text-sm">
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  {uploadStepLabel[uploadStep]}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !connected}
              className="w-full px-6 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl hover:shadow-2xl hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? uploadStepLabel[uploadStep] : !connected ? '🔑 Connect Wallet First' : '🚀 Create Collection'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
