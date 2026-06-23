import { prisma } from '../db';
import { env } from '../env';
import { attemptSweepAndCredit } from '../lib/depositCredit';

/// Retries deposits stuck in AWAITING_SWEEP whose backoff window has elapsed.
/// Sweeps move USDT/BNB from the shared admin signer, so attempts run
/// sequentially to avoid nonce races.

const BATCH_SIZE = 10;
let running = false;

export async function tickDepositSweepWorker(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const due = await prisma.deposit.findMany({
      where: {
        status: 'AWAITING_SWEEP',
        OR: [{ nextSweepAttemptAt: null }, { nextSweepAttemptAt: { lte: new Date() } }],
      },
      orderBy: { nextSweepAttemptAt: 'asc' },
      take: BATCH_SIZE,
    });

    for (const deposit of due) {
      try {
        const outcome = await attemptSweepAndCredit(deposit);
        if (outcome.status === 'credited') {
          console.log(`[depositSweep] credited ${deposit.txHash} (tier=${outcome.tier ?? 'none'})`);
        } else if (outcome.status === 'pending_sweep') {
          console.log(`[depositSweep] still pending ${deposit.txHash}: ${outcome.error ?? ''}`);
        }
      } catch (e) {
        console.error(`[depositSweep] attempt failed for ${deposit.txHash}:`, e);
      }
    }
  } catch (e) {
    console.error('[depositSweep] tick failed', e);
  } finally {
    running = false;
  }
}

export function startDepositSweepWorker(): NodeJS.Timeout {
  console.log(`[depositSweep] starting (every ${env.SWEEP_WORKER_INTERVAL_MS}ms)`);
  void tickDepositSweepWorker();
  return setInterval(tickDepositSweepWorker, env.SWEEP_WORKER_INTERVAL_MS);
}
