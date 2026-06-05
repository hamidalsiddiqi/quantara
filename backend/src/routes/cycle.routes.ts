import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { loadTierConfig, selectTier } from '../lib/cycles';
import { getWithdrawableBalance } from '../lib/balance';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const items = await prisma.cycle.findMany({
    where: { userId: req.userId },
    orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
    take: 200,
  });
  res.json({ items });
});

router.get('/active', async (req, res) => {
  const items = await prisma.cycle.findMany({
    where: { userId: req.userId, status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
  });
  res.json({ items });
});

router.get('/tiers', async (_req, res) => {
  const tiers = await loadTierConfig();
  res.json({ tiers });
});

const buySchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((v) => new Prisma.Decimal(v as any)),
});

/// Buy a new cycle funded from the user's withdrawable balance. The debit is
/// recorded as a negative CYCLE_PURCHASE earning row, so every balance
/// aggregation (withdrawable, withdraw checks) sees it automatically.
/// Unlike on-chain deposits, balance-funded cycles pay no referral commissions.
router.post('/buy', async (req, res) => {
  const parsed = buySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid input', details: parsed.error.flatten() });
    return;
  }
  const { amount } = parsed.data;

  if (amount.lte(0)) {
    res.status(400).json({ error: 'amount must be > 0' });
    return;
  }

  const tiers = await loadTierConfig();
  const tier = selectTier(amount, tiers);
  if (!tier) {
    res.status(400).json({ error: `amount does not match any tier (minimum: ${tiers.STARTER.min} USDT)` });
    return;
  }

  try {
    const cycle = await prisma.$transaction(async (tx) => {
      const available = await getWithdrawableBalance(req.userId!, tx);
      if (amount.gt(available)) {
        throw new Error(`insufficient withdrawable balance (available: ${available.toFixed()})`);
      }

      const cfg = tiers[tier];
      const startedAt = new Date();
      const endsAt = new Date(startedAt.getTime() + cfg.durationDays * 60 * 1000);

      const created = await tx.cycle.create({
        data: {
          userId: req.userId!,
          tier,
          principal: amount,
          dailyRoiBps: cfg.dailyRoiBps,
          durationDays: cfg.durationDays,
          startedAt,
          endsAt,
        },
      });

      // Debit the withdrawable balance with a negative earning row.
      await tx.earning.create({
        data: {
          userId: req.userId!,
          cycleId: created.id,
          amount: amount.neg(),
          kind: 'CYCLE_PURCHASE',
          accruedOn: startedAt,
        },
      });

      return created;
    });

    res.status(201).json({ ok: true, cycle, tier });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'purchase failed' });
  }
});

export default router;
