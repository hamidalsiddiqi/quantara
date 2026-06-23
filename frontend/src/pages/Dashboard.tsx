import { useState, useEffect } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { api, type Cycle, type Deposit, type Withdrawal } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
    TrendingUp, Wallet, Lock, Zap, Users, BarChart3,
    ArrowRight, RefreshCw, Loader2, Clock, Bell, ArrowDownToLine, ArrowUpFromLine, Megaphone, CheckCircle2, XCircle, Award, Target
} from 'lucide-react';
import { formatUSDT, formatDate, roiPercent, daysLeft, progressPct } from '@/lib/utils';

function getRankInfo(volume: number) {
    if (volume >= 100000) return { rank: 'Diamond', progressPct: 100, rankFlow: 'Diamond', label: 'Max Rank Reached' };
    if (volume >= 25000) return { rank: 'Platinum', progressPct: ((volume - 25000) / (100000 - 25000)) * 100, rankFlow: 'Platinum → Diamond', label: `${formatUSDT(100000 - volume)} to Diamond` };
    if (volume >= 5000) return { rank: 'Gold', progressPct: ((volume - 5000) / (25000 - 5000)) * 100, rankFlow: 'Gold → Platinum', label: `${formatUSDT(25000 - volume)} to Platinum` };
    if (volume >= 1000) return { rank: 'Silver', progressPct: ((volume - 1000) / (5000 - 1000)) * 100, rankFlow: 'Silver → Gold', label: `${formatUSDT(5000 - volume)} to Gold` };
    return { rank: 'Bronze', progressPct: (volume / 1000) * 100, rankFlow: 'Bronze → Silver', label: `${formatUSDT(1000 - volume)} to Silver` };
}

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ElementType;
    accent?: boolean;
    subtext?: string;
    progress?: {
        value: number;
        label: string;
        rankFlow?: string;
    };
}

function StatCard({ title, value, icon: Icon, accent, progress }: StatCardProps) {
    return (
        <Card className={`h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${accent ? 'border-blue-600/30 bg-gradient-to-br from-blue-900/40 to-card' : ''}`}>
            <CardContent className="p-3.5 flex flex-col justify-center h-full">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{title}</p>
                        <p className={`text-lg font-bold truncate leading-tight ${accent ? 'text-brand-gradient' : ''}`}>{value}</p>
                    </div>
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${accent ? 'bg-blue-600/20' : 'bg-secondary'}`}>
                        <Icon className={`h-4 w-4 ${accent ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                    </div>
                </div>
                {progress && (
                    <div className="mt-2.5 space-y-1.5 w-full">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] font-medium text-muted-foreground">{progress.rankFlow}</span>
                            <span className="text-[9px] font-medium text-cyan-400">Progress: {Math.floor(progress.value)}%</span>
                        </div>
                        <Progress value={progress.value} className="h-1.5" />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function CycleCard({ cycle }: { cycle: Cycle }) {
    const pct = progressPct(cycle.daysAccrued, cycle.durationDays);
    const dl = daysLeft(cycle.endsAt);
    const tierColor: Record<string, string> = {
        STARTER: 'default',
        PRO: 'secondary',
        ELITE: 'default',
    };

    return (
        <Card className="hover:border-blue-600/30 transition-colors bg-secondary/10">
            <CardContent className="p-4 space-y-3">
                <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Cycle Name</span>
                        <Badge variant="outline" className="border-blue-600/30 text-cyan-400 bg-blue-600/10 uppercase tracking-widest text-[10px]">{cycle.tier}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Investment Amount</span>
                        <span className="font-bold">{formatUSDT(cycle.principal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Daily ROI</span>
                        <span className="font-bold text-cyan-400">{roiPercent(cycle.dailyRoiBps)}/day</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Days Remaining</span>
                        <span className="font-bold">{dl} days</span>
                    </div>
                </div>
                <div className="pt-2 border-t border-border/50">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5 font-medium">
                        <span>Progress (Day {cycle.daysAccrued} / {cycle.durationDays})</span>
                        <span className="text-cyan-400">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                </div>
            </CardContent>
        </Card>
    );
}

function CountdownBanner({ activeCycles }: { activeCycles: Cycle[] }) {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!activeCycles || activeCycles.length === 0) {
            setTimeLeft('24h 00m 00s');
            return;
        }

        const interval = setInterval(() => {
            const now = new Date().getTime();

            let nextPayout = Infinity;
            for (const cycle of activeCycles) {
                const cycleStart = new Date(cycle.startedAt).getTime();
                const p = cycleStart + (cycle.daysAccrued + 1) * 24 * 60 * 60 * 1000;
                if (p > now && p < nextPayout) {
                    nextPayout = p;
                }
            }

            if (nextPayout === Infinity) {
                setTimeLeft('24h 00m 00s');
                return;
            }

            const diff = nextPayout - now;

            if (diff <= 0) {
                setTimeLeft('Processing...');
                return;
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft(`${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [activeCycles]);

    if (!timeLeft) return null;

    const parts = timeLeft === 'Processing...' ? [timeLeft] : timeLeft.split(' ');

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-600/30 bg-blue-600/10 text-sm">
            <Clock className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
            <span className="text-muted-foreground text-xs">Next ROI in</span>
            <span className="font-bold text-cyan-400 tabular-nums text-xs">{timeLeft}</span>
            <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
            </span>
        </div>
    );
}

function NotificationFeed({ announcements = [] }: { announcements?: any[] }) {
    const depositQuery = useQuery({
        queryKey: ['deposit', 'history'],
        queryFn: api.deposit.history,
    });
    const withdrawQuery = useQuery({
        queryKey: ['withdraw', 'history'],
        queryFn: api.withdraw.history,
    });

    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        if (depositQuery.data && withdrawQuery.data) {
            const deposits = depositQuery.data.items.map((d: Deposit) => ({
                id: `dep_${d.id}`,
                type: 'deposit',
                title: 'Deposit',
                amount: d.amount,
                status: d.status,
                date: new Date(d.createdAt),
            }));
            const withdrawals = withdrawQuery.data.items.map((w: Withdrawal) => ({
                id: `wit_${w.id}`,
                type: 'withdrawal',
                title: 'Withdrawal',
                amount: w.amount,
                status: w.status,
                date: new Date(w.createdAt),
            }));

            const formattedAnnouncements = announcements.map((a: any) => ({
                id: `ann_${a.id}`,
                type: 'announcement',
                title: a.title,
                message: a.message,
                date: new Date(a.createdAt),
            }));

            const combined = [...deposits, ...withdrawals, ...formattedAnnouncements].sort((a, b) => b.date.getTime() - a.date.getTime());
            setItems(combined.slice(0, 6)); // show latest 6
        }
    }, [depositQuery.data, withdrawQuery.data, announcements]);

    if (depositQuery.isLoading || withdrawQuery.isLoading) {
        return (
            <Card className="border-border/50">
                <CardContent className="p-8 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/50 overflow-hidden">
            <CardHeader className="bg-card/40 pb-3 border-b border-border/50">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Bell className="h-5 w-5 text-blue-600" /> Notifications & Activity
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {items.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">No recent activity.</div>
                ) : (
                    <div className="divide-y divide-border/50">
                        {items.map((item) => (
                            <div key={item.id} className="p-4 flex items-start gap-4 hover:bg-accent/30 transition-colors">
                                <div className="mt-0.5">
                                    {item.type === 'deposit' && (
                                        <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
                                            <ArrowDownToLine className="h-4 w-4" />
                                        </div>
                                    )}
                                    {item.type === 'withdrawal' && (
                                        <div className="p-2 bg-rose-500/10 text-rose-500 rounded-full border border-rose-500/20">
                                            <ArrowUpFromLine className="h-4 w-4" />
                                        </div>
                                    )}
                                    {item.type === 'announcement' && (
                                        <div className="p-2 bg-blue-600/10 text-cyan-400 rounded-full border border-blue-600/20">
                                            <Megaphone className="h-4 w-4" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-semibold truncate text-foreground">{item.title}</p>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(item.date.toISOString())}</span>
                                    </div>
                                    {item.type === 'announcement' ? (
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.message}</p>
                                    ) : (
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm font-medium">{formatUSDT(item.amount)}</span>
                                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-border bg-background/50 text-muted-foreground`}>
                                                {item.status}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function Dashboard() {
    const { user } = useAuth();
    const { data, isLoading, error } = useQuery({
        queryKey: ['dashboard'],
        queryFn: api.dashboard.get,
        refetchInterval: 30_000,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive">
                Failed to load dashboard data. Please refresh.
            </div>
        );
    }

    const d = data!;
    const rankInfo = getRankInfo(parseFloat(d.teamVolume || '0'));

    const stats = [
        { title: 'Withdrawable Balance', value: formatUSDT(d.withdrawableBalance), icon: Wallet, accent: true, subtext: 'Available to withdraw now' },
        { title: 'Locked Capital', value: formatUSDT(d.lockedCapital), icon: Lock, subtext: 'Released when cycles complete' },
        { title: "Today's Earnings", value: formatUSDT(d.dailyEarningsToday), icon: Zap, subtext: 'ROI accrued today' },
        { title: 'Total Earnings', value: formatUSDT(d.totalRoiEarned), icon: TrendingUp, subtext: 'All-time ROI returns' },
        { title: 'Active Cycles', value: String(d.activeCycleCount), icon: RefreshCw, subtext: 'Running investment cycles' },
        { title: 'Referral Earnings', value: formatUSDT(d.referralEarnings), icon: Users, subtext: `Commissions from network` },
        { title: 'Team Volume', value: formatUSDT(d.teamVolume), icon: Target, subtext: 'Total downline deposits' },
        { title: 'Rank Status', value: rankInfo.rank, icon: Award, progress: { value: rankInfo.progressPct, label: rankInfo.label, rankFlow: rankInfo.rankFlow } },
    ];

    return (
        <div className="space-y-3">
            {/* Welcome Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl border border-blue-600/20 bg-gradient-to-br from-blue-950/80 via-[#000614] to-blue-900/30 p-5 shadow-lg">
                {/* Background glows */}
                <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-blue-600/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-cyan-500/10 blur-3xl" />

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Branding + greeting */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/70 border border-cyan-400/20 rounded-full px-2 py-0.5 bg-cyan-400/5">Quantalix Platform</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                            Welcome back, <span className="text-brand-gradient">{user?.username ?? 'Investor'}</span>!
                        </h1>
                        <p className="text-sm text-blue-200/60 mt-0.5">AI-Powered Wealth Infrastructure</p>

                        {/* Inline quick stats */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                            <div className="flex items-center gap-1.5">
                                <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
                                <span className="text-xs text-muted-foreground">Active Cycles</span>
                                <span className="text-xs font-bold text-white">{d.activeCycleCount}</span>
                            </div>
                            <div className="w-px h-3 bg-border/60" />
                            <CountdownBanner activeCycles={d.activeCycles} />
                            <div className="w-px h-3 bg-border/60" />
                            <div className="flex items-center gap-1.5">
                                <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
                                <span className="text-xs text-muted-foreground">Total Earnings</span>
                                <span className="text-xs font-bold text-white">{formatUSDT(d.totalRoiEarned)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Button variant="outline" size="sm" asChild className="border-blue-600/40 hover:bg-blue-600/10 hover:border-blue-500/60">
                            <Link to="/deposit">
                                <ArrowRight className="h-4 w-4 mr-1.5" />
                                Deposit
                            </Link>
                        </Button>
                        <Button variant="brand" size="sm" asChild>
                            <Link to="/withdraw">Withdraw</Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Latest Announcement Banner */}
            {d.announcements && d.announcements.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-blue-600/30 bg-blue-900/10 px-4 py-3 shadow-md animate-fade-in relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400" />
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600/20">
                        <Megaphone className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-foreground truncate">{d.announcements[0].title}</h4>
                        <p className="text-xs text-muted-foreground truncate">{d.announcements[0].message}</p>
                    </div>
                    <div className="flex-shrink-0 text-[10px] text-muted-foreground self-start sm:self-center">
                        {formatDate(d.announcements[0].createdAt)}
                    </div>
                </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
                {stats.map((s) => (
                    <StatCard key={s.title} {...s} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Active cycles column (takes up 2 cols on lg) */}
                <div className="lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-cyan-400" />
                            <h2 className="text-base font-semibold tracking-tight">Active Cycles</h2>
                        </div>
                        <Button variant="ghost" size="sm" asChild className="hover:text-cyan-400 transition-colors h-7 text-xs">
                            <Link to="/cycles" className="flex items-center gap-1">
                                View all <ArrowRight className="h-3 w-3" />
                            </Link>
                        </Button>
                    </div>

                    {d.activeCycles.length === 0 ? (
                        <Card className="border-dashed bg-card/40">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <RefreshCw className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
                                <p className="text-foreground font-medium text-lg">No active cycles</p>
                                <p className="text-sm text-muted-foreground mt-1 mb-5">Deposit USDT to start earning daily ROI on your assets.</p>
                                <Button variant="brand" size="sm" asChild>
                                    <Link to="/deposit">Make a Deposit</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {d.activeCycles.map((cycle) => (
                                <CycleCard key={cycle.id} cycle={cycle} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Notifications Panel */}
                <div className="lg:col-span-1">
                    <NotificationFeed announcements={d.announcements} />
                </div>
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { to: '/deposit', icon: ArrowRight, label: 'Deposit USDT', desc: 'Fund your account' },
                    { to: '/withdraw', icon: Wallet, label: 'Withdraw', desc: 'Cash out earnings' },
                    { to: '/cycles', icon: RefreshCw, label: 'Cycle History', desc: 'View all cycles' },
                    { to: '/referrals', icon: Users, label: 'Referrals', desc: 'Invite & earn 8%' },
                ].map(({ to, icon: Icon, label, desc }) => (
                    <Link key={label} to={to}>
                        <Card className="hover:border-primary/30 hover:bg-accent transition-all duration-150 cursor-pointer group">
                            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                                <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{label}</p>
                                    <p className="text-xs text-muted-foreground">{desc}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
