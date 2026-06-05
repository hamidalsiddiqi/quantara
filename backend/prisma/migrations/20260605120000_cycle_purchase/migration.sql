-- AlterEnum: balance-funded cycle purchases are recorded as negative
-- CYCLE_PURCHASE earning rows so they debit the withdrawable balance.
ALTER TYPE "EarningKind" ADD VALUE 'CYCLE_PURCHASE';
