import { Contract, parseEther, formatUnits } from 'ethers';
import { PrismaClient } from '@prisma/client';
import {
    getProvider, getAdminSigner, USDT_ADDRESS, USDC_ADDRESS, BTCB_ADDRESS, ETH_ADDRESS, ERC20_ABI, SWEEP_GAS_BNB
} from './bscProvider';
import { deriveSigner } from './hdWalletService';

const prisma = new PrismaClient();

const SWEEP_TOKENS: { symbol: string; address: string }[] = [
    { symbol: 'USDT', address: USDT_ADDRESS },
    { symbol: 'USDC', address: USDC_ADDRESS },
    { symbol: 'BTCB', address: BTCB_ADDRESS },
    { symbol: 'ETH', address: ETH_ADDRESS },
].filter(t => !!t.address);

/// Sweep stablecoin balances (USDT + USDC) from a user's derived deposit
/// address into the admin wallet. Sends BNB for gas from the admin signer
/// first, then transfers each non-zero token balance. Best-effort: failures
/// are logged, the worker will retry.
export async function sweepUserAddress(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { bscDepositIndex: true, bscDepositAddress: true }
    });
    if (user?.bscDepositIndex === null || user?.bscDepositIndex === undefined || !user.bscDepositAddress) return;

    const provider = getProvider();
    const userWallet = deriveSigner(user.bscDepositIndex);
    const admin = getAdminSigner();

    const balances = await Promise.all(SWEEP_TOKENS.map(async (tok) => {
        const c = new Contract(tok.address, ERC20_ABI, userWallet);
        const bal: bigint = await c.balanceOf(user.bscDepositAddress);
        return { ...tok, balance: bal, contract: c };
    }));

    const nonZero = balances.filter(b => b.balance > 0n);
    if (nonZero.length === 0) return;

    const gasNeeded = parseEther(SWEEP_GAS_BNB);
    const fundTx = await admin.sendTransaction({
        to: user.bscDepositAddress,
        value: gasNeeded
    });
    await fundTx.wait(1);
    console.log(`[sweep] funded ${user.bscDepositAddress} with ${SWEEP_GAS_BNB} BNB tx=${fundTx.hash}`);

    for (const tok of nonZero) {
        try {
            const transferTx = await tok.contract.transfer(admin.address, tok.balance);
            await transferTx.wait(1);
            console.log(`[sweep] swept ${formatUnits(tok.balance, 18)} ${tok.symbol} from ${user.bscDepositAddress} to admin ${admin.address} tx=${transferTx.hash}`);
        } catch (e) {
            console.error(`[sweep] ${tok.symbol} transfer failed for ${user.bscDepositAddress}:`, e);
        }
    }

    try {
        const reserve = parseEther(SWEEP_GAS_BNB);
        const bnbBalance = await provider.getBalance(user.bscDepositAddress);
        if (bnbBalance > reserve) {
            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n;
            const gasLimit = 21000n;
            const txFee = gasPrice * gasLimit;
            const sendable = bnbBalance - reserve - txFee;
            if (sendable > 0n) {
                const bnbTx = await userWallet.sendTransaction({
                    to: admin.address,
                    value: sendable,
                    gasLimit,
                    gasPrice
                });
                await bnbTx.wait(1);
                console.log(`[sweep] swept ${formatUnits(sendable, 18)} BNB from ${user.bscDepositAddress} to admin ${admin.address} tx=${bnbTx.hash}`);
            }
        }
    } catch (e) {
        console.error(`[sweep] BNB sweep failed for ${user.bscDepositAddress}:`, e);
    }
}

/// Threshold below which a wallet's BNB is considered "stuck" — too little
/// gas left in the deposit address to push out an ERC-20 transfer on its own.
export const STUCK_BNB_THRESHOLD_BNB = '0.0003';

export type StuckWallet = {
    userId: string;
    username: string;
    email: string;
    address: string;
    index: number;
    bnb: string;          // formatted BNB
    bnbWei: string;       // raw wei as string
    usdt: string;         // formatted USDT (18d)
    usdtWei: string;      // raw smallest-unit as string
};

/// Scan deposit wallets and report those that hold USDT but whose BNB balance
/// is below STUCK_BNB_THRESHOLD_BNB — i.e. they would not be able to broadcast
/// their own outgoing transfer without a top-up.
///
/// If `addressFilter` is provided, only the matching deposit address is
/// checked and the BNB threshold is ignored (the admin asked about a specific
/// wallet, so report it as long as it holds USDT).
export async function findStuckUsdtWallets(addressFilter?: string): Promise<StuckWallet[]> {
    if (!USDT_ADDRESS) return [];
    const threshold = parseEther(STUCK_BNB_THRESHOLD_BNB);
    const provider = getProvider();
    const usdt = new Contract(USDT_ADDRESS, ERC20_ABI, provider);
    const target = addressFilter?.trim().toLowerCase();

    const users = await prisma.user.findMany({
        where: target
            ? { bscDepositAddress: { equals: target, mode: 'insensitive' } }
            : { bscDepositAddress: { not: null } },
        select: {
            id: true,
            username: true,
            email: true,
            bscDepositAddress: true,
            bscDepositIndex: true,
        }
    });

    const stuck: StuckWallet[] = [];
    for (const u of users) {
        if (!u.bscDepositAddress || u.bscDepositIndex === null || u.bscDepositIndex === undefined) continue;
        try {
            const [usdtBal, bnbBal] = await Promise.all([
                usdt.balanceOf(u.bscDepositAddress) as Promise<bigint>,
                provider.getBalance(u.bscDepositAddress),
            ]);
            const passesThreshold = target ? true : bnbBal < threshold;
            if (usdtBal > 0n && passesThreshold) {
                stuck.push({
                    userId: u.id,
                    username: u.username,
                    email: u.email,
                    address: u.bscDepositAddress,
                    index: u.bscDepositIndex,
                    bnb: formatUnits(bnbBal, 18),
                    bnbWei: bnbBal.toString(),
                    usdt: formatUnits(usdtBal, 18),
                    usdtWei: usdtBal.toString(),
                });
            }
        } catch (e) {
            console.error(`[stuck-scan] ${u.bscDepositAddress}:`, e);
        }
    }
    return stuck;
}

export type CollectStuckResult = {
    address: string;
    userId: string;
    status: 'ok' | 'skipped' | 'error';
    usdtCollected?: string;
    bnbCollected?: string;
    usdtTx?: string;
    bnbTx?: string;
    fundTx?: string;
    error?: string;
};

/// Collect both USDT and any leftover BNB from a list of stuck deposit
/// addresses. Funds each with the standard sweep gas top-up first, transfers
/// the USDT to the admin wallet, then sweeps the remaining BNB back to admin.
/// `userIds` lets the admin target a specific subset returned by
/// findStuckUsdtWallets; if omitted, every currently stuck wallet is processed.
/// `address` narrows the underlying scan to a single deposit address (and
/// drops the BNB threshold).
export async function collectStuckWallets(
    userIds?: string[],
    address?: string
): Promise<CollectStuckResult[]> {
    if (!USDT_ADDRESS) throw new Error('USDT_CONTRACT_ADDRESS not configured');

    const candidates = await findStuckUsdtWallets(address);
    const filtered = userIds && userIds.length
        ? candidates.filter(c => userIds.includes(c.userId))
        : candidates;

    const provider = getProvider();
    const admin = getAdminSigner();
    const gasNeeded = parseEther(SWEEP_GAS_BNB);
    const results: CollectStuckResult[] = [];

    for (const w of filtered) {
        const out: CollectStuckResult = { address: w.address, userId: w.userId, status: 'ok' };
        try {
            const userWallet = deriveSigner(w.index);
            const usdt = new Contract(USDT_ADDRESS, ERC20_ABI, userWallet);

            const usdtBal: bigint = await usdt.balanceOf(w.address);
            if (usdtBal === 0n) {
                out.status = 'skipped';
                out.error = 'no USDT at collection time';
                results.push(out);
                continue;
            }

            // Top up with gas so the user wallet can broadcast its transfer.
            const fundTx = await admin.sendTransaction({ to: w.address, value: gasNeeded });
            await fundTx.wait(1);
            out.fundTx = fundTx.hash;

            const transferTx = await usdt.transfer(admin.address, usdtBal);
            await transferTx.wait(1);
            out.usdtTx = transferTx.hash;
            out.usdtCollected = formatUnits(usdtBal, 18);

            // Sweep whatever BNB remains back to the admin wallet.
            try {
                const bnbBalance = await provider.getBalance(w.address);
                const feeData = await provider.getFeeData();
                const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? 0n;
                const gasLimit = 21000n;
                const txFee = gasPrice * gasLimit;
                if (bnbBalance > txFee) {
                    const sendable = bnbBalance - txFee;
                    const bnbTx = await userWallet.sendTransaction({
                        to: admin.address,
                        value: sendable,
                        gasLimit,
                        gasPrice,
                    });
                    await bnbTx.wait(1);
                    out.bnbTx = bnbTx.hash;
                    out.bnbCollected = formatUnits(sendable, 18);
                }
            } catch (e: any) {
                // USDT already collected — log but don't fail the whole entry.
                console.error(`[collect-stuck] BNB sweep failed for ${w.address}:`, e);
            }
        } catch (e: any) {
            out.status = 'error';
            out.error = e?.shortMessage || e?.message || String(e);
            console.error(`[collect-stuck] ${w.address}:`, e);
        }
        results.push(out);
    }

    return results;
}

/// Scan every user with a deposit address and a non-zero stablecoin balance,
/// and sweep them. Runs in the background to recover from missed sweeps.
export async function retrySweeps(): Promise<void> {
    const users = await prisma.user.findMany({
        where: { bscDepositAddress: { not: null } },
        select: { id: true, bscDepositAddress: true }
    });
    const provider = getProvider();
    const tokenContracts = SWEEP_TOKENS.map(t => new Contract(t.address, ERC20_ABI, provider));

    for (const u of users) {
        try {
            let any = false;
            for (const c of tokenContracts) {
                const bal: bigint = await c.balanceOf(u.bscDepositAddress!);
                if (bal > 0n) { any = true; break; }
            }
            if (any) await sweepUserAddress(u.id);
        } catch (e) {
            console.error(`[sweep-retry] ${u.id}:`, e);
        }
    }
}
