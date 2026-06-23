import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { env } from '../env';
import { MIN_CONFIRMATIONS } from '../bsc/bscProvider';
import { loadTierConfig, selectTier } from './cycles';
import { payReferralCommissions } from './referrals';
import { sweepUserAddress } from '../bsc/sweepService';
import { sendDepositNotificationEmail } from './email';

/// Shared deposit-crediting pipeline used by both the user-triggered
/// `POST /deposit/verify` route and the on-chain `depositWatcher`.
///
/// A deposit must only be credited (cycle opened, referral commissions paid,
/// counted toward balance) AFTER its USDT has been swept into the admin wallet.
/// The flow is therefore split into two phases:
///   1. recordAwaitingSweep — persist the detected transfer as AWAITING_SWEEP
///      with no side effects (idempotent on txHash).
///   2. attemptSweepAndCredit — sweep, then on success credit; on failure leave
///      it AWAITING_SWEEP and schedule a backoff retry (driven by the worker).

export interface DepositDetection {
  userId: string;
  txHash: string;
  logIndex: number;
  fromAddress: string;
  toAddress: string;
  amount: Prisma.Decimal;
  blockNumber: number;
}

export type CreditOutcome =
  | { status: 'credited'; tier: string | null }
  | { status: 'pending_sweep'; error?: string }
  | { status: 'already_credited' };

/// Exponential backoff for the next sweep attempt: min(BASE * 2^attempts, MAX).
function backoffMs(attempts: number): number {
  const factor = Math.pow(2, Math.min(attempts, 30));
  return Math.min(env.SWEEP_BACKOFF_BASE_MS * factor, env.SWEEP_BACKOFF_MAX_MS);
}

const CREDITED_STATES = ['CREDITED', 'CONFIRMED'] as const;

/// Record a detected transfer as AWAITING_SWEEP. Idempotent: if a deposit for
/// this txHash already exists, it is returned untouched (so an already-credited
/// deposit is never reverted). No cycle, referral payout, or balance effect.
export async function recordAwaitingSweep(d: DepositDetection) {
  const existing = await prisma.deposit.findUnique({ where: { txHash: d.txHash } });
  if (existing) return existing;

  return prisma.deposit.upsert({
    where: { txHash: d.txHash },
    create: {
      userId: d.userId,
      txHash: d.txHash,
      logIndex: d.logIndex,
      fromAddress: d.fromAddress,
      toAddress: d.toAddress,
      amount: d.amount,
      blockNumber: d.blockNumber,
      confirmations: MIN_CONFIRMATIONS,
      status: 'AWAITING_SWEEP',
      nextSweepAttemptAt: new Date(),
    },
    update: {},
  });
}

/// Credit a deposit whose USDT has already been swept. Runs in a transaction,
/// guards that the deposit is still AWAITING_SWEEP, opens a cycle when the
/// amount matches a tier, and pays referral commissions. Mirrors the original
/// inline logic from deposit.routes.ts / depositWatcher.ts.
async function creditSweptDeposit(depositId: string): Promise<{ tier: string | null }> {
  const tiers = await loadTierConfig();

  return prisma.$transaction(async (tx) => {
    const deposit = await tx.deposit.findUnique({ where: { id: depositId } });
    if (!deposit) throw new Error('deposit not found');
    // Idempotency guard: only an awaiting-sweep deposit gets credited.
    if (deposit.status !== 'AWAITING_SWEEP') return { tier: null };

    const tier = selectTier(deposit.amount, tiers);

    if (!tier) {
      // Below any tier minimum: confirm the deposit but open no cycle.
      await tx.deposit.update({
        where: { id: deposit.id },
        data: { status: 'CONFIRMED', confirmations: MIN_CONFIRMATIONS },
      });
      return { tier: null };
    }

    const cfg = tiers[tier];
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + cfg.durationDays * 60 * 1000);

    const cycle = await tx.cycle.create({
      data: {
        userId: deposit.userId,
        tier,
        principal: deposit.amount,
        dailyRoiBps: cfg.dailyRoiBps,
        durationDays: cfg.durationDays,
        startedAt,
        endsAt,
      },
    });

    await tx.deposit.update({
      where: { id: deposit.id },
      data: { status: 'CREDITED', confirmations: MIN_CONFIRMATIONS, cycleId: cycle.id },
    });

    await payReferralCommissions(tx, {
      sourceUserId: deposit.userId,
      cycleId: cycle.id,
      depositId: deposit.id,
      principal: deposit.amount,
    });

    return { tier };
  });
}

/// Attempt to sweep the user's USDT and, on success, credit the deposit. On
/// failure the deposit stays AWAITING_SWEEP and its retry counters/backoff are
/// updated so the sweep worker picks it up later. Never throws for an expected
/// sweep failure — returns a structured outcome.
export async function attemptSweepAndCredit(deposit: {
  id: string;
  userId: string;
  status: string;
  sweepAttempts: number;
}): Promise<CreditOutcome> {
  if (CREDITED_STATES.includes(deposit.status as (typeof CREDITED_STATES)[number])) {
    return { status: 'already_credited' };
  }

  const sweep = await sweepUserAddress(deposit.userId);

  if (!sweep.ok) {
    const attempts = deposit.sweepAttempts + 1;
    await prisma.deposit.update({
      where: { id: deposit.id },
      data: {
        sweepAttempts: attempts,
        lastSweepError: sweep.error ?? 'sweep failed',
        nextSweepAttemptAt: new Date(Date.now() + backoffMs(attempts)),
      },
    });
    return { status: 'pending_sweep', error: sweep.error };
  }

  // Sweep succeeded — record the proof, then credit.
  await prisma.deposit.update({
    where: { id: deposit.id },
    data: {
      sweepTxHash: sweep.usdtTxHash ?? null,
      sweptAt: new Date(),
      lastSweepError: null,
      nextSweepAttemptAt: null,
    },
  });

  const { tier } = await creditSweptDeposit(deposit.id);

  const fullDeposit = await prisma.deposit.findUnique({
    where: { id: deposit.id },
    include: { user: true }
  });
  if (fullDeposit && fullDeposit.user) {
    sendDepositNotificationEmail(
      fullDeposit.user.email,
      fullDeposit.amount.toString(),
      fullDeposit.txHash
    ).catch((err) => console.error('[depositCredit] Error sending email:', err));
  }

  return { status: 'credited', tier };
}
