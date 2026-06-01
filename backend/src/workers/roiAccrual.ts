import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { env } from '../env';

function utcMinute(d: Date): Date {
  const x = new Date(d);
  x.setUTCSeconds(0, 0);
  return x;
}

function intervalsBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000)); // 1 day = 86,400,000 ms
}

/// For each ACTIVE cycle: accrue any missed daily ROI rows (idempotent via
/// the @@unique([cycleId, accruedOn]) index), then complete the cycle and
/// release principal when daysAccrued >= durationDays.
async function processCycle(cycleId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const cycle = await tx.cycle.findUnique({ where: { id: cycleId } });
    if (!cycle || cycle.status !== 'ACTIVE') return;

    const now = new Date();
    const dueDays = Math.min(cycle.durationDays, intervalsBetween(cycle.startedAt, now));

    for (let day = cycle.daysAccrued; day < dueDays; day++) {
      const accruedOn = utcMinute(new Date(cycle.startedAt.getTime() + (day + 1) * 24 * 60 * 60 * 1000));
      const roi = new Prisma.Decimal(cycle.principal)
        .mul(cycle.dailyRoiBps)
        .div(10_000);

      try {
        await tx.earning.create({
          data: {
            userId: cycle.userId,
            cycleId: cycle.id,
            amount: roi,
            kind: 'ROI',
            accruedOn,
          },
        });
        await tx.cycle.update({
          where: { id: cycle.id },
          data: {
            daysAccrued: { increment: 1 },
            totalAccrued: { increment: roi },
          },
        });
      } catch (e: any) {
        // P2002 unique violation — earning row for this day already exists.
        if (e?.code !== 'P2002') throw e;
      }
    }

    const fresh = await tx.cycle.findUnique({ where: { id: cycle.id } });
    if (fresh && fresh.daysAccrued >= fresh.durationDays && fresh.status === 'ACTIVE') {
      // Release principal as a final non-ROI earning row using a sentinel
      // accruedOn that won't collide with daily rows.
      const releaseDay = utcMinute(new Date(fresh.startedAt.getTime() + (fresh.durationDays + 1) * 24 * 60 * 60 * 1000));
      try {
        await tx.earning.create({
          data: {
            userId: fresh.userId,
            cycleId: fresh.id,
            amount: fresh.principal,
            kind: 'PRINCIPAL_RELEASE',
            accruedOn: releaseDay,
          },
        });
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e;
      }
      await tx.cycle.update({
        where: { id: fresh.id },
        data: { status: 'COMPLETED' },
      });
    }
  }, { maxWait: 10000, timeout: 30000 });
}

let running = false;

export async function tickRoiAccrual(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const active = await prisma.cycle.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    for (const c of active) {
      try {
        await processCycle(c.id);
      } catch (e) {
        console.error('[roiAccrual] cycle failed', c.id, e);
      }
    }
  } catch (e) {
    console.error('[roiAccrual] tick failed', e);
  } finally {
    running = false;
  }
}

export function startRoiAccrual(): NodeJS.Timeout {
  console.log(`[roiAccrual] starting (every ${env.ROI_TICK_INTERVAL_MS}ms)`);
  void tickRoiAccrual();
  return setInterval(tickRoiAccrual, env.ROI_TICK_INTERVAL_MS);
}
