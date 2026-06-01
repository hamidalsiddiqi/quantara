import express from 'express';
import cors from 'cors';
import { env } from './env';

import authRoutes from './routes/auth.routes';
import depositRoutes from './routes/deposit.routes';
import cycleRoutes from './routes/cycle.routes';
import withdrawRoutes from './routes/withdraw.routes';
import dashboardRoutes from './routes/dashboard.routes';
import adminRoutes from './routes/admin.routes';
import referralRoutes from './routes/referral.routes';

import { startRoiAccrual } from './workers/roiAccrual';
import { startWithdrawProcessor } from './workers/withdrawProcessor';

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN, credentials: false }));
app.use(express.json({ limit: '128kb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

const v1 = express.Router();
v1.use('/auth', authRoutes);
v1.use('/deposit', depositRoutes);
v1.use('/cycles', cycleRoutes);
v1.use('/withdraw', withdrawRoutes);
v1.use('/dashboard', dashboardRoutes);
v1.use('/referrals', referralRoutes);
v1.use('/admin', adminRoutes);
app.use('/api/v1', v1);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'internal error' });
});

const port = env.PORT;
app.listen(port, () => {
  console.log(`[http] listening on :${port}`);
  const enableWorkers = process.env.DISABLE_WORKERS !== '1';
  if (enableWorkers) {
    startRoiAccrual();
    startWithdrawProcessor();
  } else {
    console.log('[workers] disabled via DISABLE_WORKERS=1');
  }
});
