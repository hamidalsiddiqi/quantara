import { Contract, id as keccakId, getAddress, zeroPadValue } from 'ethers';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { env } from '../env';
import {
  getProvider,
  USDT_ADDRESS,
  ERC20_ABI,
  MIN_CONFIRMATIONS,
} from '../bsc/bscProvider';
import { unitsToDecimal, USDT_DECIMALS } from '../lib/money';
import { loadTierConfig, selectTier } from '../lib/cycles';
import { payReferralCommissions } from '../lib/referrals';
import { sweepUserAddress } from '../bsc/sweepService';

const LAST_BLOCK_KEY = 'deposit.lastScannedBlock';
const TRANSFER_TOPIC = keccakId('Transfer(address,address,uint256)');

async function getLastScannedBlock(): Promise<number | null> {
  const row = await prisma.setting.findUnique({ where: { key: LAST_BLOCK_KEY } });
  if (!row) return null;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : null;
}

async function setLastScannedBlock(n: number): Promise<void> {
  await prisma.setting.upsert({
    where: { key: LAST_BLOCK_KEY },
    create: { key: LAST_BLOCK_KEY, value: String(n) },
    update: { value: String(n) },
  });
}

type DepositUser = { id: string; address: string };

async function loadDepositAddressMap(): Promise<Map<string, DepositUser>> {
  const users = await prisma.user.findMany({
    where: { bscDepositAddress: { not: null } },
    select: { id: true, bscDepositAddress: true },
  });
  const map = new Map<string, DepositUser>();
  for (const u of users) {
    if (!u.bscDepositAddress) continue;
    map.set(u.bscDepositAddress.toLowerCase(), { id: u.id, address: u.bscDepositAddress });
  }
  return map;
}

async function creditDeposit(args: {
  userId: string;
  txHash: string;
  logIndex: number;
  fromAddress: string;
  toAddress: string;
  amount: Prisma.Decimal;
  blockNumber: number;
}): Promise<void> {
  const tiers = await loadTierConfig();
  const tier = selectTier(args.amount, tiers);

  await prisma.$transaction(async (tx) => {
    const existing = await tx.deposit.findUnique({ where: { txHash: args.txHash } });
    if (existing && existing.status === 'CREDITED') return;

    if (!tier) {
      // Amount below minimum or doesn't fit a tier — record but don't open a cycle.
      await tx.deposit.upsert({
        where: { txHash: args.txHash },
        create: {
          userId: args.userId,
          txHash: args.txHash,
          logIndex: args.logIndex,
          fromAddress: args.fromAddress,
          toAddress: args.toAddress,
          amount: args.amount,
          blockNumber: args.blockNumber,
          confirmations: MIN_CONFIRMATIONS,
          status: 'CONFIRMED',
        },
        update: { confirmations: MIN_CONFIRMATIONS, status: 'CONFIRMED' },
      });
      return;
    }

    const cfg = tiers[tier];
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + cfg.durationDays * 60 * 1000);

    const cycle = await tx.cycle.create({
      data: {
        userId: args.userId,
        tier,
        principal: args.amount,
        dailyRoiBps: cfg.dailyRoiBps,
        durationDays: cfg.durationDays,
        startedAt,
        endsAt,
      },
    });

    const deposit = await tx.deposit.upsert({
      where: { txHash: args.txHash },
      create: {
        userId: args.userId,
        txHash: args.txHash,
        logIndex: args.logIndex,
        fromAddress: args.fromAddress,
        toAddress: args.toAddress,
        amount: args.amount,
        blockNumber: args.blockNumber,
        confirmations: MIN_CONFIRMATIONS,
        status: 'CREDITED',
        cycleId: cycle.id,
      },
      update: {
        confirmations: MIN_CONFIRMATIONS,
        status: 'CREDITED',
        cycleId: cycle.id,
      },
    });

    await payReferralCommissions(tx, {
      sourceUserId: args.userId,
      cycleId: cycle.id,
      depositId: deposit.id,
      principal: args.amount,
    });
  });

  // Best-effort: sweep funds out of the deposit address into admin wallet.
  sweepUserAddress(args.userId).catch((e) =>
    console.error('[depositWatcher] sweep failed for', args.userId, e),
  );
}

async function scanRange(fromBlock: number, toBlock: number, addrMap: Map<string, DepositUser>): Promise<void> {
  if (addrMap.size === 0 || !USDT_ADDRESS) return;
  const provider = getProvider();
  const usdt = new Contract(USDT_ADDRESS, ERC20_ABI, provider);

  // ethers v6: an array in a topic position is treated as OR. We filter by
  // "to" (topic2) to only return events relevant to our users.
  const toTopics = Array.from(addrMap.values()).map((u) => zeroPadValue(getAddress(u.address), 32));

  const logs = await provider.getLogs({
    address: USDT_ADDRESS,
    fromBlock,
    toBlock,
    topics: [TRANSFER_TOPIC, null, toTopics],
  });

  for (const log of logs) {
    try {
      const parsed = usdt.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (!parsed || parsed.name !== 'Transfer') continue;
      const from = (parsed.args[0] as string).toLowerCase();
      const to = (parsed.args[1] as string).toLowerCase();
      const value: bigint = parsed.args[2] as bigint;

      const user = addrMap.get(to);
      if (!user) continue;
      if (value <= 0n) continue;

      const amount = unitsToDecimal(value, USDT_DECIMALS);
      await creditDeposit({
        userId: user.id,
        txHash: log.transactionHash,
        logIndex: log.index,
        fromAddress: from,
        toAddress: to,
        amount,
        blockNumber: log.blockNumber,
      });
    } catch (e) {
      console.error('[depositWatcher] log parse failed', e);
    }
  }
}

let running = false;

export async function tickDepositWatcher(): Promise<void> {
  if (running) return;
  running = true;
  try {
    if (!USDT_ADDRESS) return;
    const provider = getProvider();
    const head = await provider.getBlockNumber();
    const safeHead = head - MIN_CONFIRMATIONS;
    if (safeHead <= 0) return;

    const last = (await getLastScannedBlock()) ?? safeHead - 1;
    if (safeHead <= last) return;

    const addrMap = await loadDepositAddressMap();
    if (addrMap.size === 0) {
      await setLastScannedBlock(safeHead);
      return;
    }

    const chunk = env.DEPOSIT_SCAN_CHUNK;
    let cursor = last + 1;
    while (cursor <= safeHead) {
      const end = Math.min(cursor + chunk - 1, safeHead);
      await scanRange(cursor, end, addrMap);
      await setLastScannedBlock(end);
      cursor = end + 1;
    }
  } catch (e) {
    console.error('[depositWatcher] tick failed', e);
  } finally {
    running = false;
  }
}

export function startDepositWatcher(): NodeJS.Timeout {
  console.log(`[depositWatcher] starting (every ${env.DEPOSIT_POLL_INTERVAL_MS}ms)`);
  void tickDepositWatcher();
  return setInterval(tickDepositWatcher, env.DEPOSIT_POLL_INTERVAL_MS);
}
