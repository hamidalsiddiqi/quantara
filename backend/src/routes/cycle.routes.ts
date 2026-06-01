import { Router } from 'express';
import { prisma } from '../db';
import { requireAuth } from '../auth/middleware';
import { loadTierConfig } from '../lib/cycles';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const items = await prisma.cycle.findMany({
    where: { userId: req.userId },
    orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
    take: 200,
  });
  res.json({ items });
});

router.get('/active', async (req, res) => {
  const items = await prisma.cycle.findMany({
    where: { userId: req.userId, status: 'ACTIVE' },
    orderBy: { startedAt: 'desc' },
  });
  res.json({ items });
});

router.get('/tiers', async (_req, res) => {
  const tiers = await loadTierConfig();
  res.json({ tiers });
});

export default router;
