import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { requireAuth, requireAdmin } from '../auth/middleware';
import { loadTierConfig, saveTierConfig, selectTier } from '../lib/cycles';
import { payReferralCommissions, getReferralEarningsTotal, getTeamVolume, getDownlineCountsByLevel } from '../lib/referrals';
import { getWithdrawableBalance } from '../lib/balance';
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

  const userIds = users.map((u) => u.id);

  // Compute each user's real balance and profit the same way the dashboard
  // does (see lib/balance.ts + dashboard.routes.ts), batched via groupBy so we
  // don't issue per-user queries:
  //   balance = sum(earnings) + sum(referralEarnings) + adminBalance - sum(non-failed withdrawals)
  //   profit  = sum(ROI earnings) + adminProfits
  const [earningsByUser, roiByUser, referralByUser, withdrawalsByUser, depositsByUser, teamVolRows] = await Promise.all([
    prisma.earning.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _sum: { amount: true },
    }),
    prisma.earning.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, kind: 'ROI' },
      _sum: { amount: true },
    }),
    prisma.referralEarning.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _sum: { amount: true },
    }),
    prisma.withdrawal.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, status: { in: ['PENDING', 'SIGNED', 'BROADCAST', 'CONFIRMED'] } },
      _sum: { amount: true },
    }),
    prisma.deposit.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, status: { in: ['CONFIRMED', 'CREDITED'] } },
      _sum: { amount: true },
    }),
    prisma.referralEarning.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, cycleId: true, amount: true, bps: true },
      distinct: ['userId', 'cycleId']
    }),
  ]);

  const sumMap = (
    rows: { userId: string; _sum: { amount: Prisma.Decimal | null } }[],
  ): Map<string, Prisma.Decimal> => {
    const m = new Map<string, Prisma.Decimal>();
    for (const r of rows) m.set(r.userId, r._sum.amount ?? new Prisma.Decimal(0));
    return m;
  };

  const earnings = sumMap(earningsByUser);
  const roi = sumMap(roiByUser);
  const referrals = sumMap(referralByUser);
  const withdrawals = sumMap(withdrawalsByUser);
  const deposits = sumMap(depositsByUser);
  const zero = new Prisma.Decimal(0);

  const teamVolMap = new Map<string, Prisma.Decimal>();
  for (const r of teamVolRows) {
    const p = r.amount.mul(10000).div(r.bps);
    const cur = teamVolMap.get(r.userId) ?? zero;
    teamVolMap.set(r.userId, cur.add(p));
  }

  const enriched = users.map((u) => {
    const balance = (earnings.get(u.id) ?? zero)
      .add(referrals.get(u.id) ?? zero)
      .add(u.adminBalance)
      .sub(withdrawals.get(u.id) ?? zero);
    const profit = (roi.get(u.id) ?? zero).add(u.adminProfits);
    const totalDeposit = deposits.get(u.id) ?? zero;
    const teamVolume = teamVolMap.get(u.id) ?? zero;
    return {
      ...u,
      balance: balance.toFixed(),
      profit: profit.toFixed(),
      totalDeposit: totalDeposit.toFixed(),
      teamVolume: teamVolume.toFixed(),
    };
  });

  res.json({ users: enriched });
});

// Full detail for a single user — loaded when an admin opens the user card.
router.get('/users/:id', async (req, res) => {
  const id = req.params.id;
  const user = await prisma.user.findUnique({
    where: { id },
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
      referralCode: true,
      referrerId: true,
      createdAt: true,
      referrer: { select: { username: true, email: true } },
      _count: { select: { cycles: true, deposits: true, withdrawals: true, referrals: true } },
    },
  });
  if (!user) {
    res.status(404).json({ error: 'user not found' });
    return;
  }

  const [
    balance,
    roiAgg,
    totalDepositAgg,
    teamVolume,
    referralEarnings,
    referralCountsByLevel,
    recentDeposits,
    recentWithdrawals,
    recentCycles,
  ] = await Promise.all([
    getWithdrawableBalance(id),
    prisma.earning.aggregate({ where: { userId: id, kind: 'ROI' }, _sum: { amount: true } }),
    prisma.deposit.aggregate({
      where: { userId: id, status: { in: ['CONFIRMED', 'CREDITED'] } },
      _sum: { amount: true },
    }),
    getTeamVolume(id),
    getReferralEarningsTotal(id),
    getDownlineCountsByLevel(id),
    prisma.deposit.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.withdrawal.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.cycle.findMany({ where: { userId: id }, orderBy: { startedAt: 'desc' }, take: 10 }),
  ]);

  const profit = (roiAgg._sum.amount ?? new Prisma.Decimal(0)).add(user.adminProfits);
  const totalDeposit = totalDepositAgg._sum.amount ?? new Prisma.Decimal(0);

  res.json({
    user,
    balance: balance.toFixed(),
    profit: profit.toFixed(),
    totalDeposit: totalDeposit.toFixed(),
    teamVolume: teamVolume.toFixed(),
    referralEarnings: referralEarnings.toFixed(),
    referralCountsByLevel,
    recentDeposits,
    recentWithdrawals,
    recentCycles,
  });
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
