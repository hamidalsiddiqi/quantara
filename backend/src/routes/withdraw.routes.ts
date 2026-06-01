import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { isAddress } from 'ethers';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { getWithdrawableBalance } from '../lib/balance';

const router = Router();

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

      const requestId = '0x' + randomBytes(32).toString('hex');
      const w = await tx.withdrawal.create({
        data: {
          userId: req.userId!,
          toAddress,
          amount,
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
  res.json({ withdrawable: balance.toFixed() });
});

export default router;
