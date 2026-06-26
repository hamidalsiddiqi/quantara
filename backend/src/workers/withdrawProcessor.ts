import { Contract, getAddress } from 'ethers';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { env } from '../env';
import {
  getProvider,
  getAdminSigner,
  USDT_ADDRESS,
  ERC20_ABI,
} from '../bsc/bscProvider';
import { decimalToUnits, USDT_DECIMALS } from '../lib/money';
import { sendWithdrawalNotificationEmail } from '../lib/email';

/// Mark a withdrawal failed with an error message.
async function failWithdrawal(id: string, message: string): Promise<void> {
  await prisma.withdrawal.update({
    where: { id },
    data: { status: 'FAILED', error: message.slice(0, 500), processedAt: new Date() },
  });
}

/// Sanity check that the user still has enough withdrawable balance to cover
/// this withdrawal. We exclude THIS withdrawal from "outstanding" because
/// we're about to settle it.
async function hasSufficientBalance(userId: string, withdrawalId: string, amount: Prisma.Decimal): Promise<boolean> {
  const [earnings, referral, outstanding, user] = await Promise.all([
    prisma.earning.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.referralEarning.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.withdrawal.aggregate({
      where: {
        userId,
        id: { not: withdrawalId },
        status: { in: ['PENDING', 'APPROVED', 'SIGNED', 'BROADCAST', 'CONFIRMED'] },
      },
      _sum: { amount: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { adminBalance: true } }),
  ]);
  const available = (earnings._sum.amount ?? new Prisma.Decimal(0))
    .add(referral._sum.amount ?? new Prisma.Decimal(0))
    .add(user?.adminBalance ?? new Prisma.Decimal(0))
    .sub(outstanding._sum.amount ?? new Prisma.Decimal(0));
  return available.gte(amount);
}

async function processPending(): Promise<void> {
  const pending = await prisma.withdrawal.findMany({
    where: { status: 'APPROVED' },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });
  if (pending.length === 0) return;


  const admin = getAdminSigner();
  const usdt = new Contract(USDT_ADDRESS, ERC20_ABI, admin);

  for (const w of pending) {
    try {
      const ok = await hasSufficientBalance(w.userId, w.id, new Prisma.Decimal(w.amount));
      if (!ok) {
        await failWithdrawal(w.id, 'insufficient withdrawable balance at processing time');
        continue;
      }

      // Check admin wallet USDT balance. We send the NET amount (gross minus the
      // withdrawal fee); the gross `amount` is what gets debited from the user's
      // balance, while `netAmount` is what actually leaves the admin wallet.
      const adminBalance = await usdt.balanceOf(admin.address);
      const units = decimalToUnits(new Prisma.Decimal(w.netAmount), USDT_DECIMALS);
      if (adminBalance < units) {
        console.error(`[withdrawProcessor] admin wallet insufficient USDT balance: has ${adminBalance.toString()}, needs ${units.toString()}`);
        // We don't fail the withdrawal here, just skip it to retry later when admin refills.
        continue;
      }

      await prisma.withdrawal.update({
        where: { id: w.id },
        data: { status: 'SIGNED' },
      });

      const tx = await usdt.transfer(getAddress(w.toAddress), units);
      await prisma.withdrawal.update({
        where: { id: w.id },
        data: { status: 'BROADCAST', txHash: tx.hash },
      });

      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) {
        await failWithdrawal(w.id, `tx reverted (hash=${tx.hash})`);
        continue;
      }

      await prisma.withdrawal.update({
        where: { id: w.id },
        data: { status: 'CONFIRMED', processedAt: new Date() },
      });
      console.log(`[withdrawProcessor] CONFIRMED ${w.id} tx=${tx.hash}`);

      const user = await prisma.user.findUnique({ where: { id: w.userId } });
      if (user) {
        sendWithdrawalNotificationEmail(
          user.email,
          w.amount.toString(),
          w.netAmount.toString(),
          tx.hash
        ).catch(() => { });
      }
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || String(e);
      console.error(`[withdrawProcessor] withdrawal ${w.id} failed:`, e);
      await failWithdrawal(w.id, msg);
    }
  }
}

let running = false;

export async function tickWithdrawProcessor(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await processPending();
  } catch (e) {
    console.error('[withdrawProcessor] tick failed', e);
  } finally {
    running = false;
  }
}

export function startWithdrawProcessor(): NodeJS.Timeout {
  console.log(`[withdrawProcessor] starting (every ${env.WITHDRAW_TICK_INTERVAL_MS}ms)`);
  void tickWithdrawProcessor();
  return setInterval(tickWithdrawProcessor, env.WITHDRAW_TICK_INTERVAL_MS);
}
// Reference unused import to keep ERC20_ABI exportable for future direct-transfer mode.
void ERC20_ABI;
