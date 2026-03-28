// Aptos SDK utilities — uses @aptos-labs/ts-sdk directly for read operations
// Wallet operations (signing/submitting) must use useWallet() hook

import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const aptosConfig = new AptosConfig({ network: Network.TESTNET });
export const aptos = new Aptos(aptosConfig);

export const APTOS_EXPLORER = 'https://explorer.aptoslabs.com';

export function getTxUrl(txHash: string): string {
  return `${APTOS_EXPLORER}/txn/${txHash}?network=testnet`;
}

export function getAccountUrl(address: string): string {
  return `${APTOS_EXPLORER}/account/${address}?network=testnet`;
}

export function getCollectionUrl(address: string, collectionName: string): string {
  return `${APTOS_EXPLORER}/account/${address}/tokens?network=testnet`;
}

/**
 * Get account APT balance (returns octas as bigint)
 */
export async function getAccountBalance(address: string): Promise<bigint> {
  try {
    const balance = await aptos.getAccountCoinAmount({
      accountAddress: address,
      coinType: '0x1::aptos_coin::AptosCoin',
    });
    return BigInt(balance);
  } catch {
    return BigInt(0);
  }
}

/**
 * Get account info
 */
export async function getAccountInfo(address: string) {
  try {
    return await aptos.getAccountInfo({ accountAddress: address });
  } catch (error) {
    console.error('Error fetching account info:', error);
    throw error;
  }
}

/**
 * Get account transaction count (real, not random)
 */
export async function getAccountTransactionCount(address: string): Promise<number> {
  try {
    const info = await aptos.getAccountInfo({ accountAddress: address });
    return Number(info.sequence_number);
  } catch {
    return 0;
  }
}

/**
 * Get recent transactions for an address
 */
export async function getAccountTransactions(address: string, limit = 10): Promise<any[]> {
  try {
    return await aptos.getAccountTransactions({ accountAddress: address, options: { limit } });
  } catch {
    return [];
  }
}

/**
 * Build a "Create Collection" transaction payload using the robust Aptos V2 Digital Asset standard.
 * Completely eliminates V1 predictive naming collisions.
 */
export function buildCreateCollectionPayload(params: {
  name: string;
  description: string;
  uri: string;
  maxSupply: number;
  royaltyNumerator: number;
  royaltyDenominator: number;
}) {
  return {
    function: '0x4::aptos_token::create_collection' as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [
      params.description,
      params.maxSupply.toString(), // max_supply
      params.name,
      params.uri,
      true, // mutable_description
      true, // mutable_royalty
      true, // mutable_uri
      true, // mutable_token_description
      true, // mutable_token_name
      true, // mutable_token_properties
      true, // mutable_token_uri
      true, // tokens_burnable_by_creator
      true, // tokens_freezable_by_creator
      params.royaltyNumerator.toString(), // royalty_numerator
      params.royaltyDenominator.toString(), // royalty_denominator
    ],
  };
}

/**
 * Build a "Mint NFT" token payload using the Aptos V2 Digital Asset standard.
 * Each token becomes a unique Object, making 'TokenData already exists' impossible.
 */
export function buildMintNFTPayload(params: {
  collectionName: string;
  tokenName: string;
  description: string;
  uri: string;
  recipient: string;
}) {
  return {
    function: '0x4::aptos_token::mint' as `${string}::${string}::${string}`,
    typeArguments: [] as [],
    functionArguments: [
      params.collectionName,
      params.description,
      params.tokenName,
      params.uri,
      [], // property_keys
      [], // property_types
      [], // property_values
    ],
  };
}


/**
 * Get collections owned/created by an address using the Digital Asset standard
 */
export async function getCreatorCollections(address: string): Promise<any[]> {
  try {
    return await aptos.getAccountCollectionsWithOwnedTokens({ accountAddress: address });
  } catch {
    return [];
  }
}

/**
 * Get perfectly minted NFTs currently residing in the user's wallet
 */
export async function getOwnedTokens(address: string): Promise<any[]> {
  try {
    return await aptos.getAccountOwnedTokens({ accountAddress: address });
  } catch (error) {
    console.error('Error fetching owned tokens:', error);
    return [];
  }
}

/**
 * Wait for a transaction to be confirmed
 */
export async function waitForTransaction(txHash: string): Promise<any> {
  try {
    return await aptos.waitForTransaction({ transactionHash: txHash });
  } catch (error) {
    console.error('Error waiting for transaction:', error);
    throw error;
  }
}

/**
 * Get ledger / network info
 */
export async function getLedgerInfo() {
  return aptos.getLedgerInfo();
}
