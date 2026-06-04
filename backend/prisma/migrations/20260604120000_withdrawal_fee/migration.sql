-- AlterTable
ALTER TABLE "Withdrawal"
  ADD COLUMN "fee" DECIMAL(36,18) NOT NULL DEFAULT 0,
  ADD COLUMN "netAmount" DECIMAL(36,18) NOT NULL DEFAULT 0;

-- Backfill existing rows: prior withdrawals had no fee, so netAmount == amount.
UPDATE "Withdrawal" SET "netAmount" = "amount" WHERE "netAmount" = 0;
