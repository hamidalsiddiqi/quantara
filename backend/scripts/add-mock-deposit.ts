import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/db';
import { loadTierConfig, selectTier } from '../src/lib/cycles';
import { payReferralCommissions } from '../src/lib/referrals';
import { MIN_CONFIRMATIONS } from '../src/bsc/bscProvider';

async function main() {
    const identifier = process.argv[2]; // email or username
    const amountStr = process.argv[3];

    if (!identifier || !amountStr) {
        console.error('Usage: npx tsx scripts/add-mock-deposit.ts <email-or-username> <amount-usdt>');
        process.exit(1);
    }

    // Try finding user by email first, then username.
    let user = await prisma.user.findUnique({ where: { email: identifier } });
    if (!user) {
        user = await prisma.user.findUnique({ where: { username: identifier } });
    }

    if (!user) {
        console.error(`User '${identifier}' not found in database.`);
        process.exit(1);
    }

    const amount = new Prisma.Decimal(amountStr);
    const tiers = await loadTierConfig();
    const tier = selectTier(amount, tiers);

    if (!tier) {
        console.warn(`[WARN] Amount ${amount} USDT does not qualify for any cycle tier. Deposit will be recorded but no cycle will be created.`);
    }

    const txHash = '0xmock_' + Date.now();
    console.log(`Starting mock deposit for ${identifier} (${user.id}) | Amount: ${amount} USDT | Tier: ${tier ?? 'None'}`);

    await prisma.$transaction(async (tx) => {
        let cycleId = null;

        if (tier) {
            const cfg = tiers[tier];
            const startedAt = new Date();
            // Fast forward the end date according to duration days
            const endsAt = new Date(startedAt.getTime() + cfg.durationDays * 60 * 1000);

            const cycle = await tx.cycle.create({
                data: {
                    userId: user.id,
                    tier,
                    principal: amount,
                    dailyRoiBps: cfg.dailyRoiBps,
                    durationDays: cfg.durationDays,
                    startedAt,
                    endsAt,
                },
            });
            cycleId = cycle.id;
            console.log(`[SUCCESS] Active cycle created! ID: ${cycleId}`);
        }

        const deposit = await tx.deposit.create({
            data: {
                userId: user.id,
                txHash,
                logIndex: 0,
                fromAddress: '0xMockUserAddress',
                toAddress: user.bscDepositAddress || '0xMockPlatformAddress',
                amount,
                blockNumber: 1337,
                confirmations: MIN_CONFIRMATIONS,
                status: 'CREDITED',
                cycleId,
            },
        });
        console.log(`[SUCCESS] Deposit credited into DB! txHash: ${txHash}`);

        if (cycleId) {
            // Execute the referral multi-level payment mechanism
            await payReferralCommissions(tx as any, {
                sourceUserId: user.id,
                cycleId,
                depositId: deposit.id,
                principal: amount,
            });
            console.log(`[SUCCESS] Referral commissions dispatched for upline.`);
        }

        console.log(`\n🎉 All done! ${amount} USDT successfully deposited for ${identifier}.`);
    }, { maxWait: 10000, timeout: 30000 });
}

main().catch(console.error).finally(() => prisma.$disconnect());
