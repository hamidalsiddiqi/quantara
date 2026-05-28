import { CycleTier } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';

export type TierConfig = {
  min: number;
  max: number; // inclusive; Infinity for unlimited
  dailyRoiBps: number;
  durationDays: number;
};

export const DEFAULT_TIERS: Record<CycleTier, TierConfig> = {
  STARTER: { min: 20, max: 999, dailyRoiBps: 150, durationDays: 30 },
  PRO: { min: 1000, max: 4999, dailyRoiBps: 180, durationDays: 45 },
  ELITE: { min: 5000, max: Number.POSITIVE_INFINITY, dailyRoiBps: 200, durationDays: 60 },
};

const TIER_SETTING_KEY = 'tier.config';

export async function loadTierConfig(): Promise<Record<CycleTier, TierConfig>> {
  const row = await prisma.setting.findUnique({ where: { key: TIER_SETTING_KEY } });
  if (!row) return DEFAULT_TIERS;
  try {
    const parsed = JSON.parse(row.value) as Record<CycleTier, TierConfig>;
    return { ...DEFAULT_TIERS, ...parsed };
  } catch {
    return DEFAULT_TIERS;
  }
}

export async function saveTierConfig(cfg: Record<CycleTier, TierConfig>): Promise<void> {
  await prisma.setting.upsert({
    where: { key: TIER_SETTING_KEY },
    create: { key: TIER_SETTING_KEY, value: JSON.stringify(cfg) },
    update: { value: JSON.stringify(cfg) },
  });
}

export function selectTier(amount: Prisma.Decimal | number | string, tiers: Record<CycleTier, TierConfig>): CycleTier | null {
  const n = Number(new Prisma.Decimal(amount as any).toString());
  if (n >= tiers.ELITE.min) return 'ELITE';
  if (n >= tiers.PRO.min && n <= tiers.PRO.max) return 'PRO';
  if (n >= tiers.STARTER.min && n <= tiers.STARTER.max) return 'STARTER';
  return null;
}
