import { HDNodeWallet, Mnemonic, Wallet } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { getProvider } from './bscProvider';

const prisma = new PrismaClient();

function getMnemonic(): Mnemonic {
    const phrase = process.env.HD_MASTER_MNEMONIC;
    if (!phrase) throw new Error('HD_MASTER_MNEMONIC not set');
    return Mnemonic.fromPhrase(phrase.trim());
}

function derivationPath(index: number): string {
    return `m/44'/60'/0'/0/${index}`;
}

export function deriveAddress(index: number): string {
    const root = HDNodeWallet.fromMnemonic(getMnemonic());
    return root.derivePath(derivationPath(index).replace(/^m\//, '')).address;
}

export function deriveSigner(index: number): Wallet {
    const root = HDNodeWallet.fromMnemonic(getMnemonic());
    const node = root.derivePath(derivationPath(index).replace(/^m\//, ''));
    return new Wallet(node.privateKey, getProvider());
}

/// Ensure user has a deposit address. Atomically assigns the next available
/// index if not already set. Safe under concurrent calls because the index
/// has a @unique constraint — a collision will retry.
export async function ensureDepositAddress(userId: string): Promise<{ address: string; index: number }> {
    const existing = await prisma.user.findUnique({
        where: { id: userId },
        select: { bscDepositAddress: true, bscDepositIndex: true }
    });
    if (existing?.bscDepositAddress && existing.bscDepositIndex !== null && existing.bscDepositIndex !== undefined) {
        return { address: existing.bscDepositAddress, index: existing.bscDepositIndex };
    }

    for (let attempt = 0; attempt < 5; attempt++) {
        const last = await prisma.user.findFirst({
            where: { bscDepositIndex: { not: null } },
            orderBy: { bscDepositIndex: 'desc' },
            select: { bscDepositIndex: true }
        });
        const nextIndex = (last?.bscDepositIndex ?? -1) + 1;
        const address = deriveAddress(nextIndex);
        try {
            await prisma.user.update({
                where: { id: userId },
                data: { bscDepositAddress: address, bscDepositIndex: nextIndex }
            });
            return { address, index: nextIndex };
        } catch (e: any) {
            if (e.code === 'P2002') continue;
            throw e;
        }
    }
    throw new Error('Failed to assign deposit index after retries');
}
