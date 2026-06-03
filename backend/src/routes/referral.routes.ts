import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import {
  REFERRAL_LEVEL_BPS,
  REFERRAL_MAX_LEVEL,
  allocateReferralCode,
  getReferralEarningsTotal,
  getTeamVolume,
} from '../lib/referrals';

const router = Router();

router.use(requireAuth);

/// Returns the user's referral code, payout schedule, and overall stats.
router.get('/', async (req, res) => {
  const userId = req.userId!;
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, referralCode: true },
  });
  if (!user) {
    res.status(404).json({ error: 'user not found' });
    return;
  }
  if (!user.referralCode) {
    const code = await allocateReferralCode();
    user = await prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
      select: { id: true, referralCode: true },
    });
  }

  const [referralEarnings, teamVolume, directCount] = await Promise.all([
    getReferralEarningsTotal(userId),
    getTeamVolume(userId),
    prisma.user.count({ where: { referrerId: userId } }),
  ]);

  res.json({
    referralCode: user.referralCode,
    levels: REFERRAL_LEVEL_BPS.map((bps, i) => ({
      level: i + 1,
      bps,
      percent: bps / 100, // e.g. 12
    })),
    maxLevel: REFERRAL_MAX_LEVEL,
    referralEarnings: referralEarnings.toFixed(),
    teamVolume: teamVolume.toFixed(),
    directReferralCount: directCount,
  });
});

/// Returns per-level downline counts and per-level earnings for this user.
router.get('/stats', async (req, res) => {
  const userId = req.userId!;

  // Walk down the tree breadth-first to count members per level (up to MAX_LEVEL).
  let frontier: string[] = [userId];
  const counts: number[] = [];
  for (let level = 1; level <= REFERRAL_MAX_LEVEL; level++) {
    if (frontier.length === 0) {
      counts.push(0);
      continue;
    }
    const children = await prisma.user.findMany({
      where: { referrerId: { in: frontier } },
      select: { id: true },
    });
    counts.push(children.length);
    frontier = children.map((c) => c.id);
  }

  // Per-level earnings and volume (accounting for historical bps changes).
  const grouped = await prisma.referralEarning.groupBy({
    by: ['level', 'bps'],
    where: { userId },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const statsByLevel = new Map<number, { amount: Prisma.Decimal; volume: Prisma.Decimal; count: number }>();
  for (const g of grouped) {
    const amount = g._sum.amount ?? new Prisma.Decimal(0);
    const volume = amount.mul(10000).div(g.bps);
    const existing = statsByLevel.get(g.level) ?? {
      amount: new Prisma.Decimal(0),
      volume: new Prisma.Decimal(0),
      count: 0,
    };
    statsByLevel.set(g.level, {
      amount: existing.amount.add(amount),
      volume: existing.volume.add(volume),
      count: existing.count + g._count._all,
    });
  }

  const levels = REFERRAL_LEVEL_BPS.map((bps, i) => {
    const level = i + 1;
    const s = statsByLevel.get(level);
    return {
      level,
      bps,
      percent: bps / 100,
      memberCount: counts[i] ?? 0,
      payoutCount: s?.count ?? 0,
      earnings: (s?.amount ?? new Prisma.Decimal(0)).toFixed(),
      volume: (s?.volume ?? new Prisma.Decimal(0)).toFixed(),
    };
  });

  res.json({ levels });
});

/// Returns recent referral commission earnings (most recent first).
router.get('/earnings', async (req, res) => {
  const userId = req.userId!;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const items = await prisma.referralEarning.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      sourceUser: { select: { username: true } },
    },
  });
  res.json({
    items: items.map((i) => ({
      id: i.id,
      level: i.level,
      bps: i.bps,
      amount: i.amount.toFixed(),
      cycleId: i.cycleId,
      sourceUsername: i.sourceUser.username,
      createdAt: i.createdAt,
    })),
  });
});

/// Lists the user's direct referrals.
router.get('/downline', async (req, res) => {
  const userId = req.userId!;
  const items = await prisma.user.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      username: true,
      createdAt: true,
      _count: { select: { cycles: true, deposits: true } },
    },
    take: 200,
  });
  res.json({ items });
});

export default router;
