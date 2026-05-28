import { Prisma } from '@prisma/client';
import { prisma } from '../db';

/// Returns the user's current withdrawable balance:
///   sum(earnings.amount) - sum(non-failed withdrawals.amount)
/// Earnings include both daily ROI and end-of-cycle PRINCIPAL_RELEASE rows,
/// so once a cycle completes its principal becomes withdrawable.
export async function getWithdrawableBalance(userId: string): Promise<Prisma.Decimal> {
  const [earningsAgg, referralAgg, withdrawalsAgg] = await Promise.all([
    prisma.earning.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.referralEarning.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.withdrawal.aggregate({
      where: { userId, status: { in: ['PENDING', 'SIGNED', 'BROADCAST', 'CONFIRMED'] } },
      _sum: { amount: true },
    }),
  ]);
  const earned = earningsAgg._sum.amount ?? new Prisma.Decimal(0);
  const referral = referralAgg._sum.amount ?? new Prisma.Decimal(0);
  const withdrawn = withdrawalsAgg._sum.amount ?? new Prisma.Decimal(0);
  return earned.add(referral).sub(withdrawn);
}

/// Sum of principals locked in currently ACTIVE cycles.
export async function getLockedCapital(userId: string): Promise<Prisma.Decimal> {
  const agg = await prisma.cycle.aggregate({
    where: { userId, status: 'ACTIVE' },
    _sum: { principal: true },
  });
  return agg._sum.principal ?? new Prisma.Decimal(0);
}

/// Today's (UTC) ROI earnings for this user — only ROI rows, not principal release.
export async function getDailyEarningsToday(userId: string): Promise<Prisma.Decimal> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const agg = await prisma.earning.aggregate({
    where: { userId, kind: 'ROI', createdAt: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? new Prisma.Decimal(0);
}
