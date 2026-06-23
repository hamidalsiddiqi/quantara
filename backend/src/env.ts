import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(4000),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  BSC_RPC_URLS: z.string(),
  BSC_CHAIN_ID: z.coerce.number().default(56),
  USDT_CONTRACT_ADDRESS: z.string().default(''),
  VAULT_CONTRACT_ADDRESS: z.string().default(''),
  MIN_CONFIRMATIONS: z.coerce.number().default(3),

  HD_MASTER_MNEMONIC: z.string().min(1),
  ADMIN_SIGNER_PRIVATE_KEY: z.string().min(1),

  DEPOSIT_POLL_INTERVAL_MS: z.coerce.number().default(15000),
  ROI_TICK_INTERVAL_MS: z.coerce.number().default(60000),
  WITHDRAW_TICK_INTERVAL_MS: z.coerce.number().default(30000),
  DEPOSIT_SCAN_CHUNK: z.coerce.number().default(2000),

  // Deposit sweep retry worker. A deposit is only credited after its USDT is
  // swept to the admin wallet; failed sweeps are retried on exponential backoff
  // delay = min(BASE * 2^attempts, MAX).
  SWEEP_WORKER_INTERVAL_MS: z.coerce.number().default(60000),
  SWEEP_BACKOFF_BASE_MS: z.coerce.number().default(30000),
  SWEEP_BACKOFF_MAX_MS: z.coerce.number().default(3600000),

  // Withdrawal fee in basis points (500 = 5%), deducted from the requested amount.
  WITHDRAW_FEE_BPS: z.coerce.number().int().min(0).max(10000).default(500),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
