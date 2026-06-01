import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { getWithdrawableBalance, getLockedCapital, getDailyEarningsToday } from '../lib/balance';
import { getReferralEarningsTotal, getTeamVolume } from '../lib/referrals';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const userId = req.userId!;
  const [
    withdrawable,
    lockedCapital,
    dailyEarningsToday,
    activeCount,
    totalEarnedAgg,
    activeCycles,
    referralEarnings,
    teamVolume,
    announcements,
  ] = await Promise.all([
    getWithdrawableBalance(userId),
    getLockedCapital(userId),
    getDailyEarningsToday(userId),
    prisma.cycle.count({ where: { userId, status: 'ACTIVE' } }),
    prisma.earning.aggregate({ where: { userId, kind: 'ROI' }, _sum: { amount: true } }),
    prisma.cycle.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { startedAt: 'desc' },
    }),
    getReferralEarningsTotal(userId),
    getTeamVolume(userId),
    prisma.announcement.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  res.json({
    withdrawableBalance: withdrawable.toFixed(),
    lockedCapital: lockedCapital.toFixed(),
    dailyEarningsToday: dailyEarningsToday.toFixed(),
    totalRoiEarned: (totalEarnedAgg._sum.amount ?? '0').toString(),
    activeCycleCount: activeCount,
    referralEarnings: referralEarnings.toFixed(),
    teamVolume: teamVolume.toFixed(),
    activeCycles,
    announcements,
  });
});

export default router;
