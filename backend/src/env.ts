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
  USDC_CONTRACT_ADDRESS: z.string().default(''),
  BTCB_CONTRACT_ADDRESS: z.string().default(''),
  ETH_CONTRACT_ADDRESS: z.string().default(''),
  VAULT_CONTRACT_ADDRESS: z.string().default(''),
  MIN_CONFIRMATIONS: z.coerce.number().default(3),

  HD_MASTER_MNEMONIC: z.string().min(1),
  ADMIN_SIGNER_PRIVATE_KEY: z.string().min(1),

  DEPOSIT_POLL_INTERVAL_MS: z.coerce.number().default(15000),
  ROI_TICK_INTERVAL_MS: z.coerce.number().default(60000),
  WITHDRAW_TICK_INTERVAL_MS: z.coerce.number().default(30000),
  DEPOSIT_SCAN_CHUNK: z.coerce.number().default(2000),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
