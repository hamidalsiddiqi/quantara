import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { requireAuth, requireAdmin } from '../auth/middleware';
import { loadTierConfig, saveTierConfig, selectTier } from '../lib/cycles';
import { payReferralCommissions } from '../lib/referrals';
import { MIN_CONFIRMATIONS } from '../bsc/bscProvider';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      email: true,
      username: true,
      isAdmin: true,
      isBanned: true,
      adminBalance: true,
      adminProfits: true,
      bscDepositAddress: true,
      bscWithdrawAddress: true,
      createdAt: true,
      _count: { select: { cycles: true, deposits: true, withdrawals: true } },
    },
  });
  res.json({ users });
});

router.get('/withdrawals', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
  const items = await prisma.withdrawal.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { email: true, username: true } } },
  });
  res.json({ items });
});

router.get('/deposits', async (_req, res) => {
  const items = await prisma.deposit.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { email: true, username: true } } },
  });
  res.json({ items });
});

router.post('/withdrawals/:id/retry', async (req, res) => {
  const id = req.params.id;
  const w = await prisma.withdrawal.findUnique({ where: { id } });
  if (!w) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  if (w.status !== 'FAILED') {
    res.status(400).json({ error: `cannot retry withdrawal in status ${w.status}` });
    return;
  }
  const updated = await prisma.withdrawal.update({
    where: { id },
    data: { status: 'PENDING', error: null, processedAt: null },
  });
  res.json({ withdrawal: updated });
});

router.get('/settings', async (_req, res) => {
  const tiers = await loadTierConfig();
  const all = await prisma.setting.findMany();
  res.json({ tiers, settings: all });
});

const tierConfigSchema = z.record(
  z.enum(['STARTER', 'PRO', 'ELITE']),
  z.object({
    min: z.number().nonnegative(),
    max: z.number().positive(),
    dailyRoiBps: z.number().int().min(0).max(10_000),
    durationDays: z.number().int().min(1).max(3650),
  }),
);

router.put('/settings/tiers', async (req, res) => {
  const parsed = tierConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid tier config', details: parsed.error.flatten() });
    return;
  }
  await saveTierConfig(parsed.data as any);
  res.json({ ok: true });
});

router.post('/announcements', async (req, res) => {
  const schema = z.object({ title: z.string().min(1), message: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid announcement payload' });
    return;
  }
  const ann = await prisma.announcement.create({
    data: { title: parsed.data.title, message: parsed.data.message },
  });
  res.json({ announcement: ann });
});

router.delete('/announcements/:id', async (req, res) => {
  try {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: 'not found' });
  }
});

const adjustSchema = z.object({
  action: z.enum(['add', 'deduct']),
  amount: z.string().regex(/^\d+(\.\d+)?$/)
});

router.post('/users/:id/balance', async (req, res) => {
  try {
    const parsed = adjustSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'user not found' });

    const amt = new Prisma.Decimal(parsed.amount);
    const newBal = parsed.action === 'add' ? (user.adminBalance as any).add(amt) : (user.adminBalance as any).sub(amt);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { adminBalance: newBal },
      select: { id: true, adminBalance: true }
    });
    res.json({ user: updated });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'invalid input' });
  }
});

router.post('/users/:id/profit', async (req, res) => {
  try {
    const parsed = adjustSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'user not found' });

    const amt = new Prisma.Decimal(parsed.amount);
    const newProf = parsed.action === 'add' ? (user.adminProfits as any).add(amt) : (user.adminProfits as any).sub(amt);

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { adminProfits: newProf },
      select: { id: true, adminProfits: true }
    });
    res.json({ user: updated });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'invalid input' });
  }
});

const depositSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/),
});

// Admin-credited deposit. Mirrors scripts/add-mock-deposit.ts so the same
// referral + cycle side-effects run as a real on-chain deposit would trigger.
router.post('/users/:id/deposit', async (req, res) => {
  try {
    const parsed = depositSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'user not found' });

    const amount = new Prisma.Decimal(parsed.amount);
    if (amount.lte(0)) return res.status(400).json({ error: 'amount must be positive' });

    const tiers = await loadTierConfig();
    const tier = selectTier(amount, tiers);

    const txHash = '0xadmin_' + Date.now();

    const result = await prisma.$transaction(async (tx) => {
      let cycleId: string | null = null;

      if (tier) {
        const cfg = tiers[tier];
        const startedAt = new Date();
        // Match the on-chain credit flow: endsAt fast-forwarded by durationDays.
        const endsAt = new Date(startedAt.getTime() + cfg.durationDays * 60 * 1000);

        const cycle = await tx.cycle.create({
          data: {
            userId: user.id,
            tier,
            principal: amount,
            dailyRoiBps: cfg.dailyRoiBps,
            durationDays: cfg.durationDays,
            startedAt,
            endsAt,
          },
        });
        cycleId = cycle.id;
      }

      const deposit = await tx.deposit.create({
        data: {
          userId: user.id,
          txHash,
          logIndex: 0,
          fromAddress: '0xAdminCredited',
          toAddress: user.bscDepositAddress || '0xMockPlatformAddress',
          amount,
          blockNumber: 0,
          confirmations: MIN_CONFIRMATIONS,
          status: tier ? 'CREDITED' : 'CONFIRMED',
          cycleId,
        },
      });

      if (cycleId) {
        await payReferralCommissions(tx, {
          sourceUserId: user.id,
          cycleId,
          depositId: deposit.id,
          principal: amount,
        });
      }

      return { depositId: deposit.id, cycleId, tier };
    }, { maxWait: 10000, timeout: 30000 });

    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'invalid input' });
  }
});

const banSchema = z.object({
  ban: z.boolean()
});

router.post('/users/:id/ban', async (req, res) => {
  try {
    const parsed = banSchema.parse(req.body);
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: parsed.ban },
      select: { id: true, isBanned: true }
    });
    res.json({ user: updated });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'invalid input' });
  }
});

export default router;
