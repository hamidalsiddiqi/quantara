import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAuth, requireAdmin } from '../auth/middleware';
import { loadTierConfig, saveTierConfig } from '../lib/cycles';

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

export default router;
