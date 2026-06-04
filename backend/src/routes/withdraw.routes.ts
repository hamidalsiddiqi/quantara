import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { isAddress } from 'ethers';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { getWithdrawableBalance } from '../lib/balance';
import { env } from '../env';

const router = Router();

const FEE_BPS = new Prisma.Decimal(env.WITHDRAW_FEE_BPS);
const BPS_DENOMINATOR = new Prisma.Decimal(10000);

/// Minimum gap between withdrawal requests per account.
const WITHDRAW_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/// Statuses that count against the once-per-24h limit. A FAILED request moved no
/// funds, so it does not lock the account out — the user may retry immediately.
const COOLDOWN_STATUSES = ['PENDING', 'SIGNED', 'BROADCAST', 'CONFIRMED'] as const;

/// Returns the timestamp at which the user may submit their next withdrawal,
/// or null if they are not currently within a cooldown window. Pass a Prisma
/// transaction client when calling inside a transaction.
async function getNextWithdrawalAt(
  client: Pick<typeof prisma, 'withdrawal'>,
  userId: string,
): Promise<Date | null> {
  const last = await client.withdrawal.findFirst({
    where: { userId, status: { in: COOLDOWN_STATUSES as unknown as any[] } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!last) return null;
  const next = new Date(last.createdAt.getTime() + WITHDRAW_COOLDOWN_MS);
  return next.getTime() > Date.now() ? next : null;
}

/// Split a gross withdrawal amount into the platform fee and the net amount the
/// user actually receives on-chain. Fee is rounded up (to 18 decimals) so the
/// net never exceeds amount * (1 - feeRate).
function computeFee(amount: Prisma.Decimal): { fee: Prisma.Decimal; netAmount: Prisma.Decimal } {
  const fee = amount.mul(FEE_BPS).div(BPS_DENOMINATOR).toDecimalPlaces(18, Prisma.Decimal.ROUND_UP);
  const netAmount = amount.sub(fee);
  return { fee, netAmount };
}

router.use(requireAuth);

const withdrawSchema = z.object({
  toAddress: z.string().refine((v) => isAddress(v), { message: 'invalid BSC address' }),
  amount: z.union([z.string(), z.number()]).transform((v) => new Prisma.Decimal(v as any)),
});

router.post('/', async (req, res) => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input', details: parsed.error.flatten() });
    return;
  }
  const { toAddress, amount } = parsed.data;

  if (amount.lte(0)) {
    res.status(400).json({ error: 'amount must be > 0' });
    return;
  }

  try {
    const withdrawal = await prisma.$transaction(async (tx) => {
      const nextAt = await getNextWithdrawalAt(tx, req.userId!);
      if (nextAt) {
        const err: any = new Error(
          `withdrawal limit reached: only one request per 24h. Next available at ${nextAt.toISOString()}`,
        );
        err.nextWithdrawalAt = nextAt.toISOString();
        throw err;
      }

      const earnings = await tx.earning.aggregate({
        where: { userId: req.userId },
        _sum: { amount: true },
      });
      const outstanding = await tx.withdrawal.aggregate({
        where: { userId: req.userId, status: { in: ['PENDING', 'SIGNED', 'BROADCAST', 'CONFIRMED'] } },
        _sum: { amount: true },
      });
      const available = (earnings._sum.amount ?? new Prisma.Decimal(0)).sub(
        outstanding._sum.amount ?? new Prisma.Decimal(0),
      );
      if (amount.gt(available)) {
        throw new Error(`insufficient withdrawable balance (available: ${available.toFixed()})`);
      }

      const { fee, netAmount } = computeFee(amount);
      if (netAmount.lte(0)) {
        throw new Error('amount too small to cover the withdrawal fee');
      }

      const requestId = '0x' + randomBytes(32).toString('hex');
      const w = await tx.withdrawal.create({
        data: {
          userId: req.userId!,
          toAddress,
          amount,
          fee,
          netAmount,
          requestId,
          status: 'PENDING',
        },
      });

      // Remember last-used payout address for UX.
      await tx.user.update({
        where: { id: req.userId! },
        data: { bscWithdrawAddress: toAddress },
      });

      return w;
    });

    res.status(201).json({ withdrawal });
  } catch (e: any) {
    if (e?.nextWithdrawalAt) {
      res.status(429).json({ error: e.message, nextWithdrawalAt: e.nextWithdrawalAt });
      return;
    }
    res.status(400).json({ error: e?.message ?? 'withdraw failed' });
  }
});

router.get('/history', async (req, res) => {
  const items = await prisma.withdrawal.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ items });
});

router.get('/balance', async (req, res) => {
  const balance = await getWithdrawableBalance(req.userId!);
  const nextWithdrawalAt = await getNextWithdrawalAt(prisma, req.userId!);
  res.json({
    withdrawable: balance.toFixed(),
    feeBps: env.WITHDRAW_FEE_BPS,
    nextWithdrawalAt: nextWithdrawalAt ? nextWithdrawalAt.toISOString() : null,
  });
});

export default router;
