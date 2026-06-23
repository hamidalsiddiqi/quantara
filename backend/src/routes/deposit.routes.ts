import { Router } from 'express';
import { z } from 'zod';
import { Contract, getAddress, id as keccakId, zeroPadValue } from 'ethers';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { ensureDepositAddress } from '../bsc/hdWalletService';
import { env } from '../env';
import { getProvider, USDT_ADDRESS, ERC20_ABI, MIN_CONFIRMATIONS } from '../bsc/bscProvider';
import { unitsToDecimal, USDT_DECIMALS } from '../lib/money';
import { recordAwaitingSweep, attemptSweepAndCredit } from '../lib/depositCredit';

const router = Router();

router.use(requireAuth);

router.get('/address', async (req, res) => {
  try {
    const { address } = await ensureDepositAddress(req.userId!);
    res.json({
      address,
      network: 'BSC',
      chainId: env.BSC_CHAIN_ID,
      token: 'USDT',
      tokenAddress: env.USDT_CONTRACT_ADDRESS,
      minConfirmations: env.MIN_CONFIRMATIONS,
    });
  } catch (e: any) {
    console.error('[deposit/address]', e);
    res.status(500).json({ error: e?.message ?? 'failed to derive deposit address' });
  }
});

router.get('/history', async (req, res) => {
  const items = await prisma.deposit.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ items });
});

const verifySchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'invalid tx hash'),
});

router.post('/verify', async (req, res) => {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid input', details: parsed.error.flatten() });
      return;
    }
    const { txHash } = parsed.data;

    const existingDeposit = await prisma.deposit.findUnique({ where: { txHash } });
    if (existingDeposit) {
      res.status(400).json({ error: 'transaction already processed' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !user.bscDepositAddress) {
      res.status(400).json({ error: 'please generate a deposit address first' });
      return;
    }
    const myDepositAddress = user.bscDepositAddress.toLowerCase();

    if (!USDT_ADDRESS) {
      res.status(500).json({ error: 'USDT contract address not configured' });
      return;
    }

    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      res.status(400).json({ error: 'transaction not found on network yet' });
      return;
    }
    if (receipt.status === 0) {
      res.status(400).json({ error: 'transaction failed on network' });
      return;
    }

    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;
    if (confirmations < MIN_CONFIRMATIONS) {
      res.status(400).json({ error: `Not enough confirmations. Required: ${MIN_CONFIRMATIONS}, current: ${confirmations}` });
      return;
    }

    const usdt = new Contract(USDT_ADDRESS, ERC20_ABI, provider);
    let validLog: any = null;
    let transferAmount = 0n;
    let fromAddr = '';

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== USDT_ADDRESS.toLowerCase()) continue;
      try {
        const parsedLog = usdt.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!parsedLog || parsedLog.name !== 'Transfer') continue;
        const to = (parsedLog.args[1] as string).toLowerCase();
        if (to === myDepositAddress) {
          validLog = log;
          transferAmount = parsedLog.args[2] as bigint;
          fromAddr = (parsedLog.args[0] as string).toLowerCase();
          break;
        }
      } catch (e) { }
    }

    if (!validLog || transferAmount <= 0n) {
      res.status(400).json({ error: 'no valid USDT transfer to your deposit address found in this transaction' });
      return;
    }

    const amountDecimal = unitsToDecimal(transferAmount, USDT_DECIMALS);

    // Gate crediting on a successful sweep: record the deposit as
    // AWAITING_SWEEP, then sweep the USDT to the admin wallet and only credit
    // (open cycle + pay referrals) once that succeeds. If the sweep fails the
    // deposit stays AWAITING_SWEEP and the sweep worker retries it.
    const deposit = await recordAwaitingSweep({
      userId: user.id,
      txHash,
      logIndex: validLog.index,
      fromAddress: fromAddr,
      toAddress: myDepositAddress,
      amount: amountDecimal,
      blockNumber: receipt.blockNumber,
    });

    const outcome = await attemptSweepAndCredit(deposit);

    if (outcome.status === 'pending_sweep') {
      res.json({ ok: true, status: 'pending_sweep', amount: amountDecimal.toString() });
      return;
    }

    res.json({
      ok: true,
      status: 'credited',
      amount: amountDecimal.toString(),
      tier: outcome.status === 'credited' ? outcome.tier : null,
    });
  } catch (err: any) {
    if (err.message === 'transaction already processed') {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[deposit/verify]', err);
    res.status(500).json({ error: 'verification failed' });
  }
});

export default router;
