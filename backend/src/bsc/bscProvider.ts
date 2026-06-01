import {
  FallbackProvider,
  JsonRpcProvider,
  Contract,
  Wallet,
} from 'ethers';
import { env } from '../env';

const rpcUrls = env.BSC_RPC_URLS.split(',').map((s) => s.trim()).filter(Boolean);
const chainId = env.BSC_CHAIN_ID;

export const USDT_ADDRESS = env.USDT_CONTRACT_ADDRESS.trim();
export const USDC_ADDRESS = env.USDC_CONTRACT_ADDRESS.trim();
export const BTCB_ADDRESS = env.BTCB_CONTRACT_ADDRESS.trim();
export const ETH_ADDRESS = env.ETH_CONTRACT_ADDRESS.trim();
export const VAULT_ADDRESS = env.VAULT_CONTRACT_ADDRESS.trim();
export const MIN_CONFIRMATIONS = env.MIN_CONFIRMATIONS;
export const SWEEP_GAS_BNB = '0.0008';
export const CHAIN_ID = chainId;

export type Currency = 'USDT' | 'USDC' | 'BTCB' | 'ETH';

export function tokenAddress(currency: Currency): string {
  switch (currency) {
    case 'USDC': return USDC_ADDRESS;
    case 'BTCB': return BTCB_ADDRESS;
    case 'ETH': return ETH_ADDRESS;
    default: return USDT_ADDRESS;
  }
}

export const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export const VAULT_ABI = [
  'function withdraw(address to, uint256 amount, bytes32 requestId)',
  'function usedRequestIds(bytes32) view returns (bool)',
  'function signer() view returns (address)',
  'function balance() view returns (uint256)',
  'event Withdraw(address indexed to, uint256 amount, bytes32 indexed requestId)',
];

let providerSingleton: FallbackProvider | JsonRpcProvider | null = null;
export function getProvider(): FallbackProvider | JsonRpcProvider {
  if (providerSingleton) return providerSingleton;
  if (rpcUrls.length === 0) throw new Error('BSC_RPC_URLS not configured');
  if (rpcUrls.length === 1) {
    providerSingleton = new JsonRpcProvider(rpcUrls[0], chainId);
  } else {
    const providers = rpcUrls.map((url, i) => ({
      provider: new JsonRpcProvider(url, chainId),
      priority: i + 1,
      stallTimeout: 4000,
      weight: 1,
    }));
    providerSingleton = new FallbackProvider(providers, chainId);
  }
  return providerSingleton;
}

const decimalsCache = new Map<string, number>();
export async function getTokenDecimals(currency: Currency = 'USDT'): Promise<number> {
  const addr = tokenAddress(currency);
  if (!addr) throw new Error(`${currency}_CONTRACT_ADDRESS not set`);
  const cached = decimalsCache.get(addr);
  if (cached !== undefined) return cached;
  const c = new Contract(addr, ERC20_ABI, getProvider());
  const d = Number(await c.decimals());
  decimalsCache.set(addr, d);
  return d;
}

export async function getUsdtDecimals(): Promise<number> {
  return getTokenDecimals('USDT');
}

export function getAdminSigner(): Wallet {
  return new Wallet(env.ADMIN_SIGNER_PRIVATE_KEY, getProvider());
}
