import {
    FallbackProvider,
    JsonRpcProvider,
    Contract,
    Wallet
} from 'ethers';

const rpcUrls = (process.env.BSC_RPC_URLS ?? 'https://data-seed-prebsc-1-s1.binance.org:8545/,https://data-seed-prebsc-2-s1.binance.org:8545/')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const chainId = Number(process.env.BSC_CHAIN_ID ?? 97);

export const USDT_ADDRESS = (process.env.USDT_CONTRACT_ADDRESS ?? '').trim();
export const USDC_ADDRESS = (process.env.USDC_CONTRACT_ADDRESS ?? '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d').trim();
export const BTCB_ADDRESS = (process.env.BTCB_CONTRACT_ADDRESS ?? '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c').trim();
export const ETH_ADDRESS = (process.env.ETH_CONTRACT_ADDRESS ?? '0x2170Ed0880ac9A755fd29B2688956BD959F933F8').trim();
export const VAULT_ADDRESS = (process.env.VAULT_CONTRACT_ADDRESS ?? '').trim();
export const MIN_CONFIRMATIONS = Number(process.env.MIN_CONFIRMATIONS ?? 3);
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
    'event Transfer(address indexed from, address indexed to, uint256 value)'
];

export const VAULT_ABI = [
    'function withdraw(address to, uint256 amount, bytes32 requestId)',
    'function usedRequestIds(bytes32) view returns (bool)',
    'function signer() view returns (address)',
    'function balance() view returns (uint256)',
    'event Withdraw(address indexed to, uint256 amount, bytes32 indexed requestId)'
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
            weight: 1
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
    const key = process.env.ADMIN_SIGNER_PRIVATE_KEY;
    if (!key) throw new Error('ADMIN_SIGNER_PRIVATE_KEY not set');
    return new Wallet(key, getProvider());
}
