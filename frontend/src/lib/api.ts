const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

function getToken(): string | null {
    return localStorage.getItem('qnt_token');
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        const msg = data?.error ?? `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data as T;
}

// ── Auth ────────────────────────────────────────────────
export interface User {
    id: string;
    email: string;
    username: string;
    isAdmin: boolean;
    createdAt: string;
    bscDepositAddress?: string | null;
    bscWithdrawAddress?: string | null;
    referralCode?: string | null;
    referrerId?: string | null;
}

export interface AuthResponse {
    user: User;
    token: string;
}

export const api = {
    auth: {
        register: (body: { email: string; username: string; password: string; referralCode?: string }) =>
            request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

        login: (body: { identifier: string; password: string }) =>
            request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

        me: () => request<{ user: User }>('/auth/me'),

        forgotPassword: (body: { email: string }) =>
            request<{ ok: boolean }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),

        resetPassword: (body: { token: string; password: string }) =>
            request<{ ok: boolean }>('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
    },

    // ── Referrals ────────────────────────────────────────
    referrals: {
        overview: () =>
            request<{
                referralCode: string;
                levels: { level: number; bps: number; percent: number }[];
                maxLevel: number;
                referralEarnings: string;
                teamVolume: string;
                directReferralCount: number;
            }>('/referrals'),

        stats: () =>
            request<{
                levels: {
                    level: number;
                    bps: number;
                    percent: number;
                    memberCount: number;
                    payoutCount: number;
                    earnings: string;
                }[];
            }>('/referrals/stats'),

        earnings: (limit?: number) =>
            request<{
                items: {
                    id: string;
                    level: number;
                    bps: number;
                    amount: string;
                    cycleId: string;
                    sourceUsername: string;
                    createdAt: string;
                }[];
            }>(`/referrals/earnings${limit ? `?limit=${limit}` : ''}`),

        downline: () =>
            request<{
                items: {
                    id: string;
                    username: string;
                    createdAt: string;
                    _count: { cycles: number; deposits: number };
                }[];
            }>('/referrals/downline'),
    },

    // ── Dashboard ─────────────────────────────────────────
    dashboard: {
        get: () =>
            request<{
                withdrawableBalance: string;
                lockedCapital: string;
                dailyEarningsToday: string;
                totalRoiEarned: string;
                activeCycleCount: number;
                referralEarnings: string;
                teamVolume: string;
                activeCycles: Cycle[];
                announcements: Announcement[];
            }>('/dashboard'),
    },

    // ── Deposit ───────────────────────────────────────────
    deposit: {
        address: () =>
            request<{
                address: string;
                network: string;
                chainId: number;
                token: string;
                tokenAddress: string;
                minConfirmations: number;
            }>('/deposit/address'),

        history: () => request<{ items: Deposit[] }>('/deposit/history'),

        verify: (body: { txHash: string }) =>
            request<{ ok: boolean; status: 'credited' | 'pending_sweep'; amount: string; tier?: string | null }>('/deposit/verify', {
                method: 'POST',
                body: JSON.stringify(body),
            }),
    },

    // ── Cycles ────────────────────────────────────────────
    cycles: {
        list: () => request<{ items: Cycle[] }>('/cycles'),
        active: () => request<{ items: Cycle[] }>('/cycles/active'),
        tiers: () => request<{ tiers: TierConfig }>('/cycles/tiers'),
        buy: (body: { amount: string }) =>
            request<{ ok: boolean; cycle: Cycle; tier: string }>('/cycles/buy', {
                method: 'POST',
                body: JSON.stringify(body),
            }),
    },

    // ── Withdraw ──────────────────────────────────────────
    withdraw: {
        balance: () => request<{ withdrawable: string; feeBps: number; nextWithdrawalAt: string | null }>('/withdraw/balance'),
        history: () => request<{ items: Withdrawal[] }>('/withdraw/history'),
        submit: (body: { toAddress: string; amount: string }) =>
            request<{ withdrawal: Withdrawal }>('/withdraw', { method: 'POST', body: JSON.stringify(body) }),
    },

    // ── Admin ─────────────────────────────────────────────
    admin: {
        users: () =>
            request<{
                users: AdminUser[];
            }>('/admin/users'),

        userDetail: (id: string) =>
            request<AdminUserDetail>(`/admin/users/${id}`),

        adjustBalance: (id: string, action: 'add' | 'deduct', amount: string) =>
            request<{ user: AdminUser }>(`/admin/users/${id}/balance`, { method: 'POST', body: JSON.stringify({ action, amount }) }),

        adjustProfit: (id: string, action: 'add' | 'deduct', amount: string) =>
            request<{ user: AdminUser }>(`/admin/users/${id}/profit`, { method: 'POST', body: JSON.stringify({ action, amount }) }),

        addDeposit: (id: string, amount: string) =>
            request<{ ok: boolean; depositId: string; cycleId: string | null; tier: string | null }>(`/admin/users/${id}/deposit`, { method: 'POST', body: JSON.stringify({ amount }) }),

        banUser: (id: string, ban: boolean) =>
            request<{ user: AdminUser }>(`/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ ban }) }),

        withdrawals: (status?: string) =>
            request<{ items: WithdrawalAdmin[] }>(`/admin/withdrawals${status ? `?status=${status}` : ''}`),

        deposits: () => request<{ items: DepositAdmin[] }>('/admin/deposits'),

        retryWithdrawal: (id: string) =>
            request<{ withdrawal: Withdrawal }>(`/admin/withdrawals/${id}/retry`, { method: 'POST' }),

        settings: () => request<{ tiers: TierConfig; settings: Setting[] }>('/admin/settings'),

        saveTiers: (tiers: TierConfig) =>
            request<{ ok: boolean }>('/admin/settings/tiers', { method: 'PUT', body: JSON.stringify(tiers) }),

        createAnnouncement: (body: { title: string; message: string }) =>
            request<{ announcement: Announcement }>('/admin/announcements', { method: 'POST', body: JSON.stringify(body) }),

        deleteAnnouncement: (id: string) =>
            request<{ ok: boolean }>(`/admin/announcements/${id}`, { method: 'DELETE' }),
    },
};

// ── Shared types ──────────────────────────────────────────
export interface Cycle {
    id: string;
    userId: string;
    tier: 'STARTER' | 'PRO' | 'ELITE';
    principal: string;
    dailyRoiBps: number;
    durationDays: number;
    startedAt: string;
    endsAt: string;
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    daysAccrued: number;
    totalAccrued: string;
}

export interface Deposit {
    id: string;
    txHash: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    blockNumber: number;
    confirmations: number;
    status: 'PENDING' | 'AWAITING_SWEEP' | 'CONFIRMED' | 'CREDITED' | 'FAILED';
    createdAt: string;
}

export interface Withdrawal {
    id: string;
    toAddress: string;
    amount: string;
    fee: string;
    netAmount: string;
    status: 'PENDING' | 'SIGNED' | 'BROADCAST' | 'CONFIRMED' | 'FAILED';
    txHash?: string | null;
    error?: string | null;
    createdAt: string;
    processedAt?: string | null;
}

export interface AdminUser {
    id: string;
    email: string;
    username: string;
    isAdmin: boolean;
    isBanned: boolean;
    adminBalance: string;
    adminProfits: string;
    balance: string;
    profit: string;
    totalDeposit?: string;
    teamVolume?: string;
    bscDepositAddress?: string | null;
    bscWithdrawAddress?: string | null;
    createdAt: string;
    _count: { cycles: number; deposits: number; withdrawals: number };
}

export interface AdminUserDetail {
    user: {
        id: string;
        email: string;
        username: string;
        isAdmin: boolean;
        isBanned: boolean;
        adminBalance: string;
        adminProfits: string;
        bscDepositAddress?: string | null;
        bscWithdrawAddress?: string | null;
        referralCode?: string | null;
        referrerId?: string | null;
        createdAt: string;
        referrer?: { username: string; email: string } | null;
        _count: { cycles: number; deposits: number; withdrawals: number; referrals: number };
    };
    balance: string;
    profit: string;
    totalDeposit: string;
    teamVolume: string;
    referralEarnings: string;
    referralCountsByLevel: number[];
    recentDeposits: Deposit[];
    recentWithdrawals: Withdrawal[];
    recentCycles: Cycle[];
}

export interface WithdrawalAdmin extends Withdrawal {
    user: { email: string; username: string };
}

export interface DepositAdmin extends Deposit {
    user: { email: string; username: string };
}

export interface TierConfig {
    STARTER: TierDef;
    PRO: TierDef;
    ELITE: TierDef;
}

export interface TierDef {
    min: number;
    max: number;
    dailyRoiBps: number;
    durationDays: number;
}

export interface Setting {
    key: string;
    value: string;
}

export interface Announcement {
    id: string;
    title: string;
    message: string;
    active: boolean;
    createdAt: string;
}
