import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import type { PrismaClient } from '@prisma/client';

/// Basis points paid to each upline level. Index 0 == direct (level 1) sponsor.
/// 1 bps = 0.01%, so 1200 bps = 12%.
export const REFERRAL_LEVEL_BPS = [1200, 600, 300, 200, 100, 50] as const;
export const REFERRAL_MAX_LEVEL = REFERRAL_LEVEL_BPS.length;

/// Total referral payout as a fraction of principal (for documentation/UI).
export const REFERRAL_TOTAL_BPS = REFERRAL_LEVEL_BPS.reduce((a, b) => a + b, 0); // 2250 = 22.5%

/// Generate a short, URL-safe referral code. Uppercase alphanumerics, ambiguity-free alphabet.
export function generateReferralCode(len = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/// Allocate a unique referral code for a user, retrying on collision.
export async function allocateReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode(8);
    const existing = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  // Final fallback: longer code
  return generateReferralCode(12);
}

/// Walk the upline chain up to REFERRAL_MAX_LEVEL ancestors.
async function getUpline(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<{ id: string; level: number }[]> {
  const out: { id: string; level: number }[] = [];
  let cursor: string | null = userId;
  const seen = new Set<string>([userId]);
  for (let level = 1; level <= REFERRAL_MAX_LEVEL; level++) {
    const u: { referrerId: string | null } | null = await tx.user.findUnique({
      where: { id: cursor! },
      select: { referrerId: true },
    });
    if (!u || !u.referrerId) break;
    if (seen.has(u.referrerId)) break; // defensive against cycles
    out.push({ id: u.referrerId, level });
    seen.add(u.referrerId);
    cursor = u.referrerId;
  }
  return out;
}

/// Credit referral commissions for a deposit cycle. Uses the provided tx client so callers
/// can include it in the same atomic transaction that creates the deposit + cycle.
export async function payReferralCommissions(
  tx: Prisma.TransactionClient,
  args: {
    sourceUserId: string;
    cycleId: string;
    depositId?: string | null;
    principal: Prisma.Decimal;
  },
): Promise<void> {
  const upline = await getUpline(tx, args.sourceUserId);
  if (upline.length === 0) return;

  for (const ancestor of upline) {
    const bps = REFERRAL_LEVEL_BPS[ancestor.level - 1];
    if (!bps) continue;
    // amount = principal * bps / 10000, rounded down to 18 decimals.
    const amount = args.principal.mul(bps).div(10000);
    if (amount.lte(0)) continue;
    try {
      await tx.referralEarning.create({
        data: {
          userId: ancestor.id,
          sourceUserId: args.sourceUserId,
          cycleId: args.cycleId,
          depositId: args.depositId ?? null,
          level: ancestor.level,
          bps,
          amount,
        },
      });
    } catch (e: any) {
      // Unique constraint (cycleId,userId,level) -> already paid; ignore.
      if (e?.code !== 'P2002') throw e;
    }
  }
}

/// Aggregate total referral earnings credited to this user.
export async function getReferralEarningsTotal(
  userId: string,
  client: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<Prisma.Decimal> {
  const agg = await client.referralEarning.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? new Prisma.Decimal(0);
}

/// Total principal sourced from the user's downline (all levels).
export async function getTeamVolume(
  userId: string,
  client: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<Prisma.Decimal> {
  // The sum of principals from deposits triggered by the user's direct+indirect referrals
  // is implicit in ReferralEarning rows: amount = principal * bps / 10000.
  // Rather than recompute, sum the underlying cycle principals from rows where this user is the earner at any level.
  // Use level=1 rows if available (those are the most direct mapping to 12% of principal).
  // Fall back to dividing by bps when level-1 rows are missing.
  // Simpler & accurate: join via cycleId.
  const rows = await client.referralEarning.findMany({
    where: { userId },
    select: { cycleId: true, level: true, amount: true, bps: true },
    distinct: ['cycleId'],
  });
  let total = new Prisma.Decimal(0);
  for (const r of rows) {
    // principal = amount * 10000 / bps
    const principal = r.amount.mul(10000).div(r.bps);
    total = total.add(principal);
  }
  return total;
}
