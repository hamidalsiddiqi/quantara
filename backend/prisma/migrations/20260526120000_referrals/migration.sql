-- AlterTable: add referral fields to User
ALTER TABLE "User"
  ADD COLUMN "referralCode" TEXT,
  ADD COLUMN "referrerId" TEXT;

-- Unique referral code
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- Index referrer lookups
CREATE INDEX "User_referrerId_idx" ON "User"("referrerId");

-- Self-referential FK (a user is referred by another user)
ALTER TABLE "User"
  ADD CONSTRAINT "User_referrerId_fkey"
  FOREIGN KEY ("referrerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: ReferralEarning
CREATE TABLE "ReferralEarning" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "depositId" TEXT,
    "level" INTEGER NOT NULL,
    "bps" INTEGER NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralEarning_pkey" PRIMARY KEY ("id")
);

-- One commission row per (cycle, upline user, level)
CREATE UNIQUE INDEX "ReferralEarning_cycleId_userId_level_key"
  ON "ReferralEarning"("cycleId", "userId", "level");

CREATE INDEX "ReferralEarning_userId_createdAt_idx"
  ON "ReferralEarning"("userId", "createdAt");

CREATE INDEX "ReferralEarning_sourceUserId_idx"
  ON "ReferralEarning"("sourceUserId");

-- Foreign keys
ALTER TABLE "ReferralEarning"
  ADD CONSTRAINT "ReferralEarning_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralEarning"
  ADD CONSTRAINT "ReferralEarning_sourceUserId_fkey"
  FOREIGN KEY ("sourceUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
