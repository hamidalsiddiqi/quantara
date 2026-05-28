import { Prisma } from '@prisma/client';

/// USDT-style decimals. We canonicalize all internal storage at 18 decimals
/// (Prisma Decimal(36,18)), since BSC USDT/USDC/BTCB/ETH on BSC are all 18d.
export const USDT_DECIMALS = 18;

export function toDecimal(value: string | number | bigint): Prisma.Decimal {
  if (typeof value === 'bigint') return new Prisma.Decimal(value.toString());
  return new Prisma.Decimal(value.toString());
}

export function decimalToString(d: Prisma.Decimal | string | number | null | undefined): string {
  if (d === null || d === undefined) return '0';
  return new Prisma.Decimal(d as any).toFixed();
}

/// Convert a base-unit bigint (smallest token unit, e.g. wei) into a Decimal
/// representing the human-readable token amount.
export function unitsToDecimal(units: bigint, decimals = USDT_DECIMALS): Prisma.Decimal {
  const s = units.toString();
  if (decimals === 0) return new Prisma.Decimal(s);
  const padded = s.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals);
  return new Prisma.Decimal(`${whole}.${frac}`);
}

export function decimalToUnits(value: Prisma.Decimal | string | number, decimals = USDT_DECIMALS): bigint {
  const d = new Prisma.Decimal(value as any);
  const factor = new Prisma.Decimal(10).pow(decimals);
  const scaled = d.mul(factor).toFixed(0, Prisma.Decimal.ROUND_DOWN);
  return BigInt(scaled);
}

export function addDecimals(...vals: (Prisma.Decimal | string | number)[]): Prisma.Decimal {
  return vals.reduce<Prisma.Decimal>((acc, v) => acc.add(new Prisma.Decimal(v as any)), new Prisma.Decimal(0));
}
