import { Contract, parseEther, formatUnits } from 'ethers';
import { prisma } from '../db';
import {
  getProvider,
  getAdminSigner,
  USDT_ADDRESS,
  ERC20_ABI,
  SWEEP_GAS_BNB,
} from './bscProvider';
import { deriveSigner } from './hdWalletService';

/// Outcome of a sweep attempt. `ok` means the USDT (if any) is now in the admin
/// wallet, so the deposit is safe to credit. On failure the deposit must stay
/// AWAITING_SWEEP and be retried — never credited.
export interface SweepResult {
  ok: boolean;
  usdtTxHash?: string;
  error?: string;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return String(e);
  } catch {
    return 'unknown error';
  }
}

/// Sweep the user's USDT deposit balance into the admin wallet. Sends BNB for
/// gas from the admin signer first, then transfers the USDT. Returns a
/// structured result instead of throwing so the caller can gate crediting on a
/// successful sweep. A best-effort BNB dust sweep runs afterward and does not
/// affect the result.
export async function sweepUserAddress(userId: string): Promise<SweepResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bscDepositIndex: true, bscDepositAddress: true },
  });
  if (user?.bscDepositIndex === null || user?.bscDepositIndex === undefined || !user.bscDepositAddress) {
    return { ok: false, error: 'user has no derived deposit address' };
  }
  if (!USDT_ADDRESS) {
    return { ok: false, error: 'USDT contract address not configured' };
  }

  const provider = getProvider();
  const userWallet = deriveSigner(user.bscDepositIndex);
  const admin = getAdminSigner();
  const usdt = new Contract(USDT_ADDRESS, ERC20_ABI, userWallet);

  let usdtTxHash: string | undefined;
  try {
    const balance: bigint = await usdt.balanceOf(user.bscDepositAddress);

    if (balance > 0n) {
      // Fund the deposit address with gas from the admin wallet, then move USDT.
      const gasNeeded = parseEther(SWEEP_GAS_BNB);
      const fundTx = await admin.sendTransaction({ to: user.bscDepositAddress, value: gasNeeded });
      await fundTx.wait(1);
      console.log(`[sweep] funded ${user.bscDepositAddress} with ${SWEEP_GAS_BNB} BNB tx=${fundTx.hash}`);

      const transferTx = await usdt.transfer(admin.address, balance);
      await transferTx.wait(1);
      usdtTxHash = transferTx.hash;
      console.log(`[sweep] swept ${formatUnits(balance, 18)} USDT from ${user.bscDepositAddress} to admin tx=${transferTx.hash}`);
    }
    // balance === 0n: nothing to sweep, which is still a success for gating.
  } catch (e) {
    console.error(`[sweep] USDT sweep failed for ${user.bscDepositAddress}:`, e);
    return { ok: false, error: errMsg(e) };
  }

  // Best-effort: recover leftover BNB dust. Never affects the sweep result.
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
          gasPrice,
        });
        await bnbTx.wait(1);
        console.log(`[sweep] swept ${formatUnits(sendable, 18)} BNB from ${user.bscDepositAddress} to admin tx=${bnbTx.hash}`);
      }
    }
  } catch (e) {
    console.error(`[sweep] BNB sweep failed for ${user.bscDepositAddress}:`, e);
  }

  return { ok: true, usdtTxHash };
}
