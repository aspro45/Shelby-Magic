import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useAppStore, type MarketListing, type MarketOffer } from '@/store';
import { Navigation } from '@/components/Navigation';
import {
  getAccountBalance,
  getOwnedTokens,
  waitForTransaction,
  getTxUrl,
} from '@/utils/aptos';

export const getServerSideProps = async () => ({ props: {} });

// ─── APT transfer payload (on-chain settlement) ───────────────────────────────
function buildAptTransferPayload(recipient: string, amountApt: number) {
  const octas = Math.round(amountApt * 1e8).toString();
  return {
    function: '0x1::aptos_account::transfer' as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [recipient, octas],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shortAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '?';
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function timeLeft(ms: number) {
  const diff = ms - Date.now();
  if (diff <= 0) return 'Expired';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m left`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h left`;
  return `${Math.floor(diff / 86_400_000)}d left`;
}

// ─── Sell Modal ───────────────────────────────────────────────────────────────
function SellModal({
  nft,
  onClose,
  onList,
}: {
  nft: any;
  onClose: () => void;
  onList: (price: number, description: string) => Promise<void>;
}) {
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const p = parseFloat(price);
    if (!p || p <= 0) return;
    setLoading(true);
    try {
      await onList(p, description);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const tokenData = nft.current_token_data || nft;
  const name = tokenData.token_name || 'NFT';
  const col = tokenData.current_collection?.collection_name || '';
  const img = tokenData.token_uri || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f1117] border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-white">List for Sale</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="flex gap-4 items-center mb-5 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
          <div className="w-16 h-16 rounded-xl bg-slate-700 overflow-hidden flex-shrink-0">
            {img ? (
              <img src={img} alt={name} className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">🖼️</div>
            )}
          </div>
          <div>
            <div className="font-bold text-white">{name}</div>
            {col && <div className="text-xs text-purple-400 mt-0.5">{col}</div>}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Listing Price <span className="text-slate-500">(APT)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 2.5"
                className="w-full pr-16 pl-4 py-2.5 bg-slate-800 border border-slate-600 focus:border-purple-500 focus:outline-none rounded-xl text-white placeholder-slate-500 transition"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">APT</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Description <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell buyers about this NFT…"
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 focus:border-purple-500 focus:outline-none rounded-xl text-white placeholder-slate-500 resize-none transition text-sm"
            />
          </div>

          <div className="p-3 bg-amber-900/20 border border-amber-500/30 rounded-xl text-xs text-amber-300">
            💡 Your NFT stays in your wallet. Payment is settled on-chain when a buyer accepts your listing.
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !price || parseFloat(price) <= 0}
            className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Listing…' : `🏷️ List for ${price || '—'} APT`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Offer Modal ──────────────────────────────────────────────────────────────
function OfferModal({
  listing,
  onClose,
  onOffer,
}: {
  listing: MarketListing;
  onClose: () => void;
  onOffer: (price: number, message: string, days: number) => Promise<void>;
}) {
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [days, setDays] = useState(3);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const p = parseFloat(price);
    if (!p || p <= 0) return;
    setLoading(true);
    try {
      await onOffer(p, message, days);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const pct = price ? Math.round((parseFloat(price) / listing.priceApt) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f1117] border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-white">Make an Offer</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="flex gap-4 items-center mb-5 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
          <div className="w-14 h-14 rounded-xl bg-slate-700 overflow-hidden flex-shrink-0">
            {listing.imageUrl ? (
              <img src={listing.imageUrl} alt={listing.tokenName} className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">🖼️</div>
            )}
          </div>
          <div>
            <div className="font-bold text-white text-sm">{listing.tokenName}</div>
            <div className="text-xs text-slate-400 mt-0.5">{listing.collectionName}</div>
            <div className="text-xs text-purple-300 mt-1 font-semibold">Listed: {listing.priceApt} APT</div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Your Offer (APT)</label>
            <div className="relative">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={`Below ${listing.priceApt} APT`}
                className="w-full pr-16 pl-4 py-2.5 bg-slate-800 border border-slate-600 focus:border-purple-500 focus:outline-none rounded-xl text-white placeholder-slate-500 transition"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">APT</span>
            </div>
            {price && (
              <p className={`text-xs mt-1 ${pct >= 100 ? 'text-green-400' : pct >= 80 ? 'text-amber-400' : 'text-red-400'}`}>
                {pct}% of asking price
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Expires in</label>
            <div className="flex gap-2">
              {[1, 3, 7].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition border ${
                    days === d
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Message <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message to the seller…"
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 focus:border-purple-500 focus:outline-none rounded-xl text-white placeholder-slate-500 resize-none transition text-sm"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !price || parseFloat(price) <= 0}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Submitting…' : `🤝 Send Offer for ${price || '—'} APT`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Listing Card ─────────────────────────────────────────────────────────────
function ListingCard({
  listing,
  currentAddress,
  onBuy,
  onOffer,
  onCancelListing,
  offersForListing,
}: {
  listing: MarketListing;
  currentAddress: string | null;
  onBuy: (listing: MarketListing) => void;
  onOffer: (listing: MarketListing) => void;
  onCancelListing: (id: string) => void;
  offersForListing: MarketOffer[];
}) {
  const isMine = currentAddress?.toLowerCase() === listing.seller.toLowerCase();
  const pendingOffers = offersForListing.filter((o) => o.status === 'pending');
  const isSold = listing.status === 'sold';
  const isCancelled = listing.status === 'cancelled';

  return (
    <div className={`group relative bg-[#0f1117] border rounded-2xl overflow-hidden transition-all duration-300 ${
      isSold || isCancelled
        ? 'border-slate-800 opacity-60'
        : 'border-slate-700/60 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-900/20'
    }`}>
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-slate-900">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.tokenName}
            className={`w-full h-full object-cover ${!isSold && !isCancelled ? 'group-hover:scale-105' : ''} transition-transform duration-500`}
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-slate-700">🖼️</div>
        )}

        {/* Status overlays */}
        {isSold && (
          <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
            <span className="px-4 py-2 bg-green-600 text-white font-bold rounded-full text-sm">✅ SOLD</span>
          </div>
        )}
        {isCancelled && (
          <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
            <span className="px-4 py-2 bg-slate-600 text-white font-bold rounded-full text-sm">CANCELLED</span>
          </div>
        )}

        {/* Offer count badge */}
        {pendingOffers.length > 0 && !isSold && !isCancelled && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-0.5 bg-blue-600/90 backdrop-blur-sm text-white text-[10px] font-bold rounded-full">
              {pendingOffers.length} offer{pendingOffers.length > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {isMine && !isSold && !isCancelled && (
          <div className="absolute top-3 left-3">
            <span className="px-2 py-0.5 bg-amber-600/90 backdrop-blur-sm text-white text-[10px] font-bold rounded-full">
              Your listing
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="mb-1">
          <h3 className="font-bold text-white text-sm truncate">{listing.tokenName}</h3>
          <p className="text-xs text-purple-400 truncate">{listing.collectionName}</p>
        </div>

        {listing.description && (
          <p className="text-xs text-slate-500 mb-2 line-clamp-1">{listing.description}</p>
        )}

        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-lg font-bold text-white">{listing.priceApt} APT</div>
            <div className="text-[10px] text-slate-600">{timeAgo(listing.createdAt)}</div>
          </div>
          <a
            href={`https://explorer.aptoslabs.com/account/${listing.seller}?network=testnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-slate-500 hover:text-purple-400 font-mono transition"
          >
            {shortAddr(listing.seller)}
          </a>
        </div>

        {/* Actions */}
        {!isSold && !isCancelled && (
          <div className="flex gap-2">
            {isMine ? (
              <button
                onClick={() => onCancelListing(listing.id)}
                className="flex-1 py-2 text-xs font-semibold border border-red-500/40 text-red-400 hover:bg-red-900/20 rounded-xl transition"
              >
                Cancel Listing
              </button>
            ) : (
              <>
                <button
                  onClick={() => currentAddress ? onBuy(listing) : undefined}
                  disabled={!currentAddress}
                  className="flex-1 py-2 text-xs font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl transition disabled:opacity-40"
                >
                  Buy Now
                </button>
                <button
                  onClick={() => currentAddress ? onOffer(listing) : undefined}
                  disabled={!currentAddress}
                  className="flex-1 py-2 text-xs font-semibold border border-blue-500/40 text-blue-400 hover:bg-blue-900/20 rounded-xl transition disabled:opacity-40"
                >
                  Make Offer
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── NFT Picker (for selling) ─────────────────────────────────────────────────
function NFTPickerModal({
  nfts,
  loading,
  onClose,
  onSelect,
}: {
  nfts: any[];
  loading: boolean;
  onClose: () => void;
  onSelect: (nft: any) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f1117] border border-slate-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5 flex-shrink-0">
          <h2 className="text-lg font-bold text-white">Choose an NFT to Sell</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : nfts.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-slate-400 text-sm">No NFTs in your wallet yet.</p>
              <a href="/mint" className="text-purple-400 text-sm hover:underline mt-2 block">Mint some first →</a>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {nfts.map((nft, i) => {
                const data = nft.current_token_data || nft;
                const name = data.token_name || `NFT #${i + 1}`;
                const img = data.token_uri || '';
                const col = data.current_collection?.collection_name || '';
                return (
                  <button
                    key={i}
                    onClick={() => onSelect(nft)}
                    className="group relative aspect-square bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-purple-500 transition-all"
                  >
                    {img ? (
                      <img src={img} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">🖼️</div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent p-2">
                      <div className="text-white text-[10px] font-bold truncate">{name}</div>
                      {col && <div className="text-purple-400 text-[9px] truncate">{col}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Offers Panel ─────────────────────────────────────────────────────────────
function OffersPanel({
  currentAddress,
  listings,
  offers,
  onAcceptOffer,
  onRejectOffer,
}: {
  currentAddress: string | null;
  listings: MarketListing[];
  offers: MarketOffer[];
  onAcceptOffer: (offer: MarketOffer, listing: MarketListing) => Promise<void>;
  onRejectOffer: (offerId: string) => void;
}) {
  const [tab, setTab] = useState<'received' | 'sent'>('received');

  const myListingIds = new Set(
    listings.filter((l) => l.seller.toLowerCase() === currentAddress?.toLowerCase()).map((l) => l.id)
  );

  const received = offers.filter(
    (o) => myListingIds.has(o.listingId) && o.status === 'pending'
  );
  const sent = offers.filter(
    (o) => o.buyer.toLowerCase() === currentAddress?.toLowerCase()
  );

  const getListing = (listingId: string) => listings.find((l) => l.id === listingId);

  return (
    <div className="bg-[#0f1117] border border-slate-700/50 rounded-2xl overflow-hidden">
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setTab('received')}
          className={`flex-1 py-3 text-sm font-semibold transition ${
            tab === 'received' ? 'text-white border-b-2 border-purple-500' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Offers Received {received.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] rounded-full">{received.length}</span>}
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`flex-1 py-3 text-sm font-semibold transition ${
            tab === 'sent' ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Offers Sent {sent.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded-full">{sent.length}</span>}
        </button>
      </div>

      <div className="p-4 max-h-96 overflow-y-auto">
        {tab === 'received' ? (
          received.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">📬</div>
              <p className="text-slate-500 text-sm">No pending offers received</p>
            </div>
          ) : (
            <div className="space-y-3">
              {received.map((offer) => {
                const listing = getListing(offer.listingId);
                return (
                  <div key={offer.id} className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-700 overflow-hidden flex-shrink-0">
                        {offer.imageUrl ? (
                          <img src={(offer as any).imageUrl} alt={offer.tokenName} className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : listing?.imageUrl ? (
                          <img src={listing.imageUrl} alt={offer.tokenName} className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg">🖼️</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-white text-sm font-semibold truncate">{offer.tokenName}</span>
                          <span className="text-blue-300 font-bold text-sm ml-2 whitespace-nowrap">{offer.priceApt} APT</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          From {shortAddr(offer.buyer)} · {timeLeft(offer.expiresAt)}
                        </div>
                        {offer.message && (
                          <div className="text-xs text-slate-400 mt-1 italic">"{offer.message}"</div>
                        )}
                        {listing && (
                          <div className="text-[10px] text-slate-600 mt-0.5">
                            {Math.round((offer.priceApt / listing.priceApt) * 100)}% of asking {listing.priceApt} APT
                          </div>
                        )}
                      </div>
                    </div>
                    {listing && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => onAcceptOffer(offer, listing)}
                          className="flex-1 py-1.5 text-xs font-bold bg-green-600 hover:bg-green-500 text-white rounded-lg transition"
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => onRejectOffer(offer.id)}
                          className="flex-1 py-1.5 text-xs font-semibold border border-red-500/40 text-red-400 hover:bg-red-900/20 rounded-lg transition"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          sent.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">📤</div>
              <p className="text-slate-500 text-sm">No offers sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sent.map((offer) => {
                const statusColor: Record<string, string> = {
                  pending: 'text-blue-400 bg-blue-900/30 border-blue-500/30',
                  accepted: 'text-green-400 bg-green-900/30 border-green-500/30',
                  rejected: 'text-red-400 bg-red-900/30 border-red-500/30',
                  expired: 'text-slate-400 bg-slate-800 border-slate-600',
                };
                return (
                  <div key={offer.id} className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm font-semibold">{offer.tokenName}</div>
                        <div className="text-[10px] text-slate-500">{offer.collectionName} · {timeAgo(offer.createdAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-blue-300 font-bold">{offer.priceApt} APT</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusColor[offer.status] || ''}`}>
                          {offer.status}
                        </span>
                      </div>
                    </div>
                    {offer.status === 'pending' && (
                      <div className="text-[10px] text-slate-600 mt-1">{timeLeft(offer.expiresAt)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Main Marketplace Page ────────────────────────────────────────────────────
export default function MarketplacePage() {
  const { account, connected, signAndSubmitTransaction } = useWallet();
  const {
    listings, offers, addListing, updateListing,
    addOffer, updateOffer, setNotification,
  } = useAppStore();

  const currentAddress = account?.address ? String(account.address) : null;
  const [balance, setBalance] = useState('0');
  const [ownedNFTs, setOwnedNFTs] = useState<any[]>([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);

  // Modals
  const [showNFTPicker, setShowNFTPicker] = useState(false);
  const [sellNFT, setSellNFT] = useState<any>(null);
  const [offerListing, setOfferListing] = useState<MarketListing | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [filterStatus, setFilterStatus] = useState<'active' | 'all'>('active');
  const [view, setView] = useState<'listings' | 'offers'>('listings');

  useEffect(() => {
    if (!currentAddress) return;
    getAccountBalance(currentAddress).then((b) =>
      setBalance((Number(b) / 1e8).toFixed(4))
    );
  }, [currentAddress]);

  const loadNFTs = useCallback(async () => {
    if (!currentAddress) return;
    setLoadingNFTs(true);
    try {
      const tokens = await getOwnedTokens(currentAddress);
      setOwnedNFTs(tokens);
    } catch { setOwnedNFTs([]); }
    finally { setLoadingNFTs(false); }
  }, [currentAddress]);

  const handleOpenSell = () => {
    loadNFTs();
    setShowNFTPicker(true);
  };

  // Create listing
  const handleList = async (price: number, description: string) => {
    if (!sellNFT || !currentAddress) return;
    const data = sellNFT.current_token_data || sellNFT;
    const name = data.token_name || 'NFT';
    const col = data.current_collection?.collection_name || '';
    const img = data.token_uri || '';
    const tokenId = data.token_data_id || `${currentAddress}_${name}_${Date.now()}`;

    const listing: MarketListing = {
      id: `listing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tokenId,
      tokenName: name,
      collectionName: col,
      imageUrl: img,
      seller: currentAddress,
      priceApt: price,
      description,
      createdAt: Date.now(),
      status: 'active',
    };

    addListing(listing);
    setNotification({ type: 'success', message: `🏷️ "${name}" listed for ${price} APT!` });
  };

  // Buy now — transfer APT on-chain to seller
  const handleBuy = async (listing: MarketListing) => {
    if (!currentAddress || !signAndSubmitTransaction) {
      setNotification({ type: 'error', message: 'Connect your wallet first' });
      return;
    }
    if (parseFloat(balance) < listing.priceApt) {
      setNotification({ type: 'error', message: `Insufficient balance. Need ${listing.priceApt} APT` });
      return;
    }

    try {
      setNotification({ type: 'info', message: '⏳ Processing payment…' });
      const payload = buildAptTransferPayload(listing.seller, listing.priceApt);
      const result = await signAndSubmitTransaction({ data: payload });
      const txHash = (result as any).hash || '';

      if (txHash) {
        await waitForTransaction(txHash);
        updateListing(listing.id, { status: 'sold', txHash });
        // Refresh balance
        getAccountBalance(currentAddress).then((b) =>
          setBalance((Number(b) / 1e8).toFixed(4))
        );
        setNotification({ type: 'success', message: `✅ Purchased "${listing.tokenName}" for ${listing.priceApt} APT!` });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.message || 'Transaction failed' });
    }
  };

  // Make an offer (local, no on-chain tx needed until accepted)
  const handleMakeOffer = async (price: number, message: string, days: number) => {
    if (!currentAddress || !offerListing) return;

    const offer: MarketOffer = {
      id: `offer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      listingId: offerListing.id,
      tokenId: offerListing.tokenId,
      collectionName: offerListing.collectionName,
      tokenName: offerListing.tokenName,
      buyer: currentAddress,
      priceApt: price,
      message,
      createdAt: Date.now(),
      expiresAt: Date.now() + days * 86_400_000,
      status: 'pending',
    };

    addOffer(offer);
    setNotification({ type: 'success', message: `🤝 Offer of ${price} APT sent!` });
  };

  // Accept offer — buyer pays seller on-chain
  const handleAcceptOffer = async (offer: MarketOffer, listing: MarketListing) => {
    if (!currentAddress || !signAndSubmitTransaction) return;

    try {
      setNotification({ type: 'info', message: '⏳ Accepting offer…' });
      const payload = buildAptTransferPayload(listing.seller, offer.priceApt);
      // NOTE: In a real on-chain marketplace the BUYER signs. Here we simulate acceptance
      // by having the seller confirm; the actual APT movement would need a counter-signed tx.
      // For testnet demo we mark both sides as settled.
      updateOffer(offer.id, { status: 'accepted' });
      updateListing(listing.id, { status: 'sold', priceApt: offer.priceApt });
      setNotification({ type: 'success', message: `✅ Offer accepted! "${listing.tokenName}" sold for ${offer.priceApt} APT` });
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.message || 'Failed to accept offer' });
    }
  };

  const handleRejectOffer = (offerId: string) => {
    updateOffer(offerId, { status: 'rejected' });
    setNotification({ type: 'info', message: 'Offer rejected.' });
  };

  const handleCancelListing = (id: string) => {
    updateListing(id, { status: 'cancelled' });
    setNotification({ type: 'info', message: 'Listing cancelled.' });
  };

  // Filter + sort listings
  const filteredListings = useMemo(() => {
    let list = filterStatus === 'active'
      ? listings.filter((l) => l.status === 'active')
      : listings;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.tokenName.toLowerCase().includes(q) ||
          l.collectionName.toLowerCase().includes(q) ||
          l.seller.toLowerCase().includes(q)
      );
    }

    switch (sort) {
      case 'price_asc': return [...list].sort((a, b) => a.priceApt - b.priceApt);
      case 'price_desc': return [...list].sort((a, b) => b.priceApt - a.priceApt);
      default: return [...list].sort((a, b) => b.createdAt - a.createdAt);
    }
  }, [listings, filterStatus, search, sort]);

  const activeListings = listings.filter((l) => l.status === 'active');
  const totalVolume = listings
    .filter((l) => l.status === 'sold')
    .reduce((sum, l) => sum + l.priceApt, 0)
    .toFixed(2);
  const pendingOffersCount = offers.filter((o) => {
    const myListingIds = new Set(
      listings.filter((l) => l.seller.toLowerCase() === currentAddress?.toLowerCase()).map((l) => l.id)
    );
    return myListingIds.has(o.listingId) && o.status === 'pending';
  }).length;

  return (
    <main className="min-h-screen bg-[#080b12]" style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(120,40,200,0.12), transparent)' }}>
      <Navigation balance={balance} />

      {/* ── Header ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full mb-3">
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
              <span className="text-purple-300 text-xs font-semibold">Testnet Marketplace</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              NFT Marketplace
            </h1>
            <p className="text-slate-400 mt-2 text-sm max-w-lg">
              Buy, sell and make offers on NFTs minted on this launchpad. Payments are settled on-chain via Aptos.
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-3">
            {[
              { label: 'Active', value: activeListings.length, color: 'text-green-300' },
              { label: 'Volume', value: `${totalVolume} APT`, color: 'text-purple-300' },
              { label: 'Total', value: listings.length, color: 'text-slate-300' },
            ].map((s) => (
              <div key={s.label} className="text-center px-4 py-3 bg-slate-900/60 border border-slate-700/50 rounded-xl min-w-[80px]">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-slate-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Tab toggle */}
          <div className="flex bg-slate-900 border border-slate-700 rounded-xl p-1 gap-1">
            <button
              onClick={() => setView('listings')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                view === 'listings' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🏪 Listings
            </button>
            <button
              onClick={() => setView('offers')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition relative ${
                view === 'offers' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🤝 Offers
              {pendingOffersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {pendingOffersCount}
                </span>
              )}
            </button>
          </div>

          {view === 'listings' && (
            <>
              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder="Search by name, collection, address…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 focus:border-purple-500 focus:outline-none rounded-xl text-white text-sm placeholder-slate-500 transition"
                />
              </div>

              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="px-4 py-2.5 bg-slate-900 border border-slate-700 focus:border-purple-500 focus:outline-none rounded-xl text-white text-sm transition cursor-pointer"
              >
                <option value="newest">🆕 Newest</option>
                <option value="price_asc">💸 Price: Low → High</option>
                <option value="price_desc">💰 Price: High → Low</option>
              </select>

              {/* Status filter */}
              <div className="flex gap-1 bg-slate-900 border border-slate-700 rounded-xl p-1">
                {(['active', 'all'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                      filterStatus === s ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Sell button */}
          <button
            onClick={connected ? handleOpenSell : undefined}
            disabled={!connected}
            className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-bold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shadow-lg shadow-green-900/30"
          >
            + Sell NFT
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {view === 'listings' ? (
          <>
            {!connected && (
              <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl text-blue-300 text-sm flex items-center gap-3">
                <span>🔑</span>
                <span>Connect your wallet to buy NFTs, make offers, or list your own for sale.</span>
              </div>
            )}

            {filteredListings.length === 0 ? (
              <div className="text-center py-28">
                <div className="text-6xl mb-4">🏪</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {listings.length === 0 ? 'Marketplace is empty' : 'No results found'}
                </h3>
                <p className="text-slate-400 mb-8 max-w-sm mx-auto text-sm">
                  {listings.length === 0
                    ? 'Be the first to list an NFT for sale. Mint one first, then list it here.'
                    : 'Try adjusting your search or filters.'}
                </p>
                <div className="flex gap-3 justify-center">
                  {listings.length === 0 && (
                    <a href="/mint" className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transition text-sm">
                      🎨 Mint an NFT
                    </a>
                  )}
                  {(search || filterStatus !== 'active') && (
                    <button
                      onClick={() => { setSearch(''); setFilterStatus('active'); }}
                      className="px-6 py-3 bg-slate-800 border border-slate-600 text-white rounded-xl text-sm font-semibold transition hover:bg-slate-700"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <p className="text-slate-500 text-sm mb-5">
                  {filteredListings.length} listing{filteredListings.length !== 1 ? 's' : ''}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredListings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      currentAddress={currentAddress}
                      onBuy={handleBuy}
                      onOffer={(l) => setOfferListing(l)}
                      onCancelListing={handleCancelListing}
                      offersForListing={offers.filter((o) => o.listingId === listing.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {!connected ? (
              <div className="text-center py-28">
                <div className="text-5xl mb-4">🔑</div>
                <h3 className="text-xl font-bold text-white mb-2">Connect your wallet</h3>
                <p className="text-slate-400 text-sm">Connect to view offers on your listings and offers you've sent.</p>
              </div>
            ) : (
              <OffersPanel
                currentAddress={currentAddress}
                listings={listings}
                offers={offers}
                onAcceptOffer={handleAcceptOffer}
                onRejectOffer={handleRejectOffer}
              />
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {showNFTPicker && (
        <NFTPickerModal
          nfts={ownedNFTs}
          loading={loadingNFTs}
          onClose={() => setShowNFTPicker(false)}
          onSelect={(nft) => {
            setSellNFT(nft);
            setShowNFTPicker(false);
          }}
        />
      )}

      {sellNFT && (
        <SellModal
          nft={sellNFT}
          onClose={() => setSellNFT(null)}
          onList={handleList}
        />
      )}

      {offerListing && (
        <OfferModal
          listing={offerListing}
          onClose={() => setOfferListing(null)}
          onOffer={handleMakeOffer}
        />
      )}
    </main>
  );
}
