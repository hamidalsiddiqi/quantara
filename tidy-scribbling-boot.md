# Plan: Quantalix — USDT Investment Platform (Vite + Node + Neon + BSC)

## Context

Building a greenfield USDT investment website at `D:\Dev\BrineGold\Quantalix`. The directory currently contains only `Bsc Service Example/` with three reference files (`bscProvider.ts`, `hdWalletService.ts`, `sweepService.ts`) that establish the BSC integration pattern: HD wallet–derived per-user deposit addresses, a sweep worker that consolidates incoming USDT into an admin wallet, and a vault contract pattern for signed automated withdrawals.

The app needs to:
- Onboard users (email + password, JWT).
- Generate a unique BSC deposit address per user (HD-wallet derived).
- Detect on-chain USDT deposits, credit the user, and auto-start an "investment cycle" based on amount.
- Run three tiers (Starter / Pro / Elite) with daily ROI accruing automatically.
- Keep capital **locked** until cycle completes; **profits withdrawable anytime**.
- Process withdrawals via the `VAULT_ABI` pattern (signed payout requests).
- Provide a dashboard (active cycles, daily earnings, withdrawable balance, locked capital, referral earnings, team volume — last two display zeros for now).
- Provide an admin area (view users, withdrawals, deposits, tweak settings).

User decisions made up-front:
- Auth: email + password + JWT.
- Referrals: skipped (display zeros).
- Admin: basic admin UI routes gated by `isAdmin`.
- Withdrawals: vault-contract auto-payout (matches example).
- DB: Neon Postgres + Prisma.
- Frontend: React + TypeScript + shadcn/ui + Vite.
- Env: scaffold `.env.example` placeholders; user fills in real values.

## Repository layout

```
Quantalix/
├── backend/
│   ├── src/
│   │   ├── index.ts                  # Express bootstrap + worker startup
│   │   ├── env.ts                    # zod-validated env loader
│   │   ├── db.ts                     # Prisma client singleton
│   │   ├── auth/
│   │   │   ├── jwt.ts                # sign/verify access tokens
│   │   │   ├── password.ts           # bcrypt hash/verify
│   │   │   └── middleware.ts         # requireAuth, requireAdmin
│   │   ├── bsc/
│   │   │   ├── bscProvider.ts        # adapted from example
│   │   │   ├── hdWalletService.ts    # adapted from example
│   │   │   └── sweepService.ts       # adapted from example
│   │   ├── routes/
│   │   │   ├── auth.routes.ts        # /register, /login, /me
│   │   │   ├── deposit.routes.ts     # /deposit/address, /deposit/history
│   │   │   ├── cycle.routes.ts       # /cycles, /cycles/active
│   │   │   ├── withdraw.routes.ts    # /withdraw, /withdraw/history
│   │   │   ├── dashboard.routes.ts   # /dashboard (aggregate)
│   │   │   └── admin.routes.ts       # /admin/* gated by isAdmin
│   │   ├── workers/
│   │   │   ├── depositWatcher.ts     # poll BSC for USDT Transfer events to deposit addrs
│   │   │   ├── roiAccrual.ts         # daily cron: credit ROI, complete cycles
│   │   │   └── withdrawProcessor.ts  # sign + broadcast vault.withdraw()
│   │   └── lib/
│   │       ├── money.ts              # USDT decimal helpers (BigInt <-> string)
│   │       └── cycles.ts             # tier definitions + selection
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── lib/
│   │   │   ├── api.ts                # fetch wrapper w/ JWT
│   │   │   └── auth.ts               # auth context + token storage
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Deposit.tsx
│   │   │   ├── Withdraw.tsx
│   │   │   ├── Cycles.tsx
│   │   │   └── admin/
│   │   │       ├── AdminUsers.tsx
│   │   │       ├── AdminWithdrawals.tsx
│   │   │       └── AdminSettings.tsx
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn primitives
│   │   │   ├── DashboardCards.tsx
│   │   │   ├── CycleList.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   └── index.css                 # tailwind
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── components.json               # shadcn config
└── README.md
```

## Data model (Prisma schema)

```prisma
model User {
  id                String   @id @default(cuid())
  email             String   @unique
  username          String   @unique
  passwordHash      String
  isAdmin           Boolean  @default(false)
  bscDepositAddress String?  @unique
  bscDepositIndex   Int?     @unique
  bscWithdrawAddress String? // user-supplied payout address
  createdAt         DateTime @default(now())

  cycles      Cycle[]
  deposits    Deposit[]
  withdrawals Withdrawal[]
  earnings    Earning[]
}

enum CycleTier { STARTER PRO ELITE }
enum CycleStatus { ACTIVE COMPLETED CANCELLED }

model Cycle {
  id            String      @id @default(cuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  tier          CycleTier
  principal     Decimal     @db.Decimal(36, 18)   // USDT locked
  dailyRoiBps   Int                                // basis points (150 = 1.50%)
  durationDays  Int
  startedAt     DateTime    @default(now())
  endsAt        DateTime
  status        CycleStatus @default(ACTIVE)
  daysAccrued   Int         @default(0)
  totalAccrued  Decimal     @db.Decimal(36, 18) @default(0)
  earnings      Earning[]

  @@index([userId, status])
  @@index([status, endsAt])
}

model Earning {
  id        String   @id @default(cuid())
  userId    String
  cycleId   String
  amount    Decimal  @db.Decimal(36, 18)
  accruedOn DateTime              // day stamp (UTC midnight)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  cycle     Cycle    @relation(fields: [cycleId], references: [id])

  @@unique([cycleId, accruedOn])  // idempotent daily accrual
}

enum DepositStatus { PENDING CONFIRMED CREDITED FAILED }

model Deposit {
  id            String        @id @default(cuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id])
  txHash        String        @unique
  fromAddress   String
  toAddress     String        // user's deposit address
  amount        Decimal       @db.Decimal(36, 18)
  blockNumber   Int
  confirmations Int           @default(0)
  status        DepositStatus @default(PENDING)
  cycleId       String?       // cycle created from this deposit
  createdAt     DateTime      @default(now())

  @@index([status])
}

enum WithdrawStatus { PENDING SIGNED BROADCAST CONFIRMED FAILED }

model Withdrawal {
  id          String         @id @default(cuid())
  userId      String
  user        User           @relation(fields: [userId], references: [id])
  toAddress   String
  amount      Decimal        @db.Decimal(36, 18)
  status      WithdrawStatus @default(PENDING)
  requestId   String         @unique           // bytes32 for vault
  txHash      String?
  error       String?
  createdAt   DateTime       @default(now())
  processedAt DateTime?

  @@index([status])
}

model Setting {
  key   String @id
  value String   // JSON-encoded; ROI overrides, min/max, paused flag, etc.
}
```

Withdrawable balance is computed: `sum(earnings.amount) - sum(withdrawals where status in [PENDING, SIGNED, BROADCAST, CONFIRMED])`. Capital is unlocked when `Cycle.status = COMPLETED` — at that point principal moves into withdrawable too. We do this by writing one final `Earning` row equal to the principal when the cycle finishes (keeps the math single-source).

## Cycle tiers (`lib/cycles.ts`)

```ts
export const TIERS = {
  STARTER: { min: 20,   max: 999,           dailyRoiBps: 150, days: 30 },
  PRO:     { min: 1000, max: 4999,          dailyRoiBps: 180, days: 45 },
  ELITE:   { min: 5000, max: Number.POSITIVE_INFINITY, dailyRoiBps: 200, days: 60 },
};
```
Tier is auto-selected from the deposit amount. Settings table can override min/max/bps without code change.

## BSC integration

Reuse the three example files almost verbatim — adapt the Prisma model field names (`User.bscDepositAddress`, `User.bscDepositIndex` already match). Add:

**`workers/depositWatcher.ts`** — polling loop (every ~15s) that:
1. Reads `lastScannedBlock` from `Setting`.
2. Queries USDT `Transfer` events `from any -> to in (all user deposit addresses)` in `[lastScannedBlock + 1, currentBlock - MIN_CONFIRMATIONS]`.
3. For each event: upsert `Deposit` keyed on `txHash`. On reaching CONFIRMED, in a transaction:
   - mark `Deposit.status = CREDITED`
   - select tier from amount, create `Cycle`
   - kick off `sweepUserAddress(userId)` (best-effort, async)
4. Persist new `lastScannedBlock`.

To avoid scanning the whole chain we use `provider.getLogs({ address: USDT, topics: [Transfer, null, depositAddrTopic[]], fromBlock, toBlock })` in batches of ≤2000 blocks.

**`workers/roiAccrual.ts`** — runs every minute, but only does work once per UTC day per cycle (the `Earning @@unique([cycleId, accruedOn])` guarantees idempotency even if it triggers twice):
- For every `Cycle` where `status = ACTIVE`: if `daysAccrued < durationDays` and `now >= startedAt + daysAccrued days`, create the next `Earning(amount = principal * dailyRoiBps / 10000)`, increment `daysAccrued`, add to `totalAccrued`.
- When `daysAccrued >= durationDays`: mark `COMPLETED`, write one final `Earning` row = `principal` (releases locked capital into withdrawable).

**`workers/withdrawProcessor.ts`** — picks up `Withdrawal.status = PENDING`:
1. Re-verify the user has enough withdrawable balance (race-safe inside a tx).
2. Generate `bytes32 requestId` (cuid → keccak256).
3. Build typed-data / message and sign with `ADMIN_SIGNER_PRIVATE_KEY`.
4. Call `vault.withdraw(to, amount, requestId)` from the admin signer (or relayer wallet). Store `txHash`, mark `BROADCAST`, then `CONFIRMED` after receipt.

## API surface (versioned `/api/v1`)

- `POST /auth/register` { email, username, password } → user + token
- `POST /auth/login` { email, password } → token
- `GET  /auth/me` → user profile
- `GET  /deposit/address` → ensures HD-derived address, returns `{ address, network: 'BSC', token: 'USDT' }`
- `GET  /deposit/history`
- `GET  /cycles` (active + completed)
- `POST /withdraw` { toAddress, amount } → creates `Withdrawal(PENDING)`
- `GET  /withdraw/history`
- `GET  /dashboard` → aggregate `{ activeCycles, dailyEarningsToday, withdrawableBalance, lockedCapital, referralEarnings: 0, teamVolume: 0 }`
- `GET  /admin/users`, `/admin/withdrawals`, `POST /admin/withdrawals/:id/retry`, `GET/PUT /admin/settings`

## Frontend (Vite + React + shadcn/ui)

- Vite scaffold with `@vitejs/plugin-react`, Tailwind, shadcn components installed via `npx shadcn@latest add` for: `button card input label table dialog toast tabs badge`.
- Auth context stores JWT in `localStorage`; `api.ts` attaches `Authorization: Bearer …`.
- `react-router-dom` for routing; `<ProtectedRoute>` redirects unauthenticated users to `/login`; `<AdminRoute>` requires `isAdmin`.
- `@tanstack/react-query` for data fetching/cache.
- Pages:
  - **Dashboard**: 6 cards (Active Cycles, Daily Earnings, Withdrawable, Locked Capital, Referral Earnings, Team Volume) + active cycle list with progress bars.
  - **Deposit**: shows BSC address + QR (`qrcode.react`), warns "BSC USDT only", lists tier amounts, lists deposit history.
  - **Withdraw**: input amount + payout address (defaults to last used), shows withdrawable balance, submits request.
  - **Cycles**: full history.
  - **Admin**: tables for users / withdrawals / settings editor.

## Environment variables (`.env.example`)

```
# Database
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Server
PORT=4000
JWT_SECRET=replace-me
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173

# BSC
BSC_RPC_URLS=https://bsc-dataseed.binance.org/
BSC_CHAIN_ID=56
USDT_CONTRACT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
VAULT_CONTRACT_ADDRESS=
MIN_CONFIRMATIONS=3

# Wallets
HD_MASTER_MNEMONIC="twelve word mnemonic goes here ..."
ADMIN_SIGNER_PRIVATE_KEY=0x...

# Workers
DEPOSIT_POLL_INTERVAL_MS=15000
ROI_TICK_INTERVAL_MS=60000
WITHDRAW_TICK_INTERVAL_MS=30000
```

Frontend `.env.example`:
```
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

## Build steps

1. Initialize backend (`npm init`, install `express prisma @prisma/client ethers zod bcryptjs jsonwebtoken cors dotenv`).
2. Initialize Prisma with the schema above; generate client.
3. Adapt the three example files into `backend/src/bsc/` (small edits: imports, prisma model field references).
4. Build auth + middleware.
5. Implement routes per the API surface.
6. Implement the three workers; wire them up in `index.ts` with `setInterval` (no Bull/Redis to keep the stack small — restarts are safe because of idempotent `@@unique` constraints and the `lastScannedBlock` watermark).
7. Scaffold Vite + React + shadcn/ui; install components.
8. Build pages + auth flow + react-query hooks.
9. Wire admin pages.
10. Write README with run instructions.

## Verification

Local end-to-end against **BSC testnet**:
1. Set `BSC_RPC_URLS=https://data-seed-prebsc-1-s1.binance.org:8545/`, `BSC_CHAIN_ID=97`, testnet USDT address, fresh mnemonic.
2. `cd backend && npx prisma migrate dev && npm run dev`.
3. `cd frontend && npm install && npm run dev`.
4. Register a user → call `GET /deposit/address` → confirm HD address shows up in DB and UI.
5. Send 25 testnet USDT to the address from a test wallet → wait one minute → deposit watcher should record it, create a STARTER cycle, sweep funds to admin wallet.
6. Manually set the cycle's `startedAt` 31 days in the past → ROI worker should complete the cycle and write the principal-release earning row.
7. Submit a withdrawal of an amount ≤ withdrawable → verify vault tx broadcasts and `Withdrawal.status` reaches CONFIRMED.
8. Admin user (DB-flipped `isAdmin = true`) can hit `/admin/users` and `/admin/withdrawals`.

Type-check on both ends: `tsc --noEmit` in backend, `tsc -b` in frontend. No automated tests in this initial scaffold — the verification steps above cover the critical paths manually.

## Out of scope (this build)

- Referral system (display zeros).
- Multi-currency (USDT only, even though example references USDC/BTCB/ETH).
- 2FA / email verification.
- Rate limiting beyond a basic `express-rate-limit` on auth routes.
- Production deployment scripts / Docker (README will note Neon + a Node host like Railway/Fly).
