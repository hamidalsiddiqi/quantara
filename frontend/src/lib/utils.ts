import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatUSDT(value: string | number, decimals = 4): string {
    const num = parseFloat(String(value));
    if (isNaN(num)) return '0.0000 USDT';
    return `${num.toFixed(decimals)} USDT`;
}

export function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function shortAddress(addr: string): string {
    if (!addr || addr.length < 10) return addr;
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function roiPercent(bps: number): string {
    return `${(bps / 100).toFixed(2)}%`;
}

export function daysLeft(endsAt: string): number {
    const diff = new Date(endsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86_400_000));
}

export function progressPct(accrued: number, total: number): number {
    if (total === 0) return 0;
    return Math.min(100, Math.round((accrued / total) * 100));
}
