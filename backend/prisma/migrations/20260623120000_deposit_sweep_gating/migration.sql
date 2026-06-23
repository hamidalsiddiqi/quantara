-- AlterEnum
ALTER TYPE "DepositStatus" ADD VALUE 'AWAITING_SWEEP';

-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "lastSweepError" TEXT,
ADD COLUMN     "nextSweepAttemptAt" TIMESTAMP(3),
ADD COLUMN     "sweepAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sweepTxHash" TEXT,
ADD COLUMN     "sweptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Deposit_status_nextSweepAttemptAt_idx" ON "Deposit"("status", "nextSweepAttemptAt");
