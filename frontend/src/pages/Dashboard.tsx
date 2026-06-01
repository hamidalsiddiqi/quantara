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

function getRankStatus(volume: number) {
    if (volume >= 100000) return 'Diamond';
    if (volume >= 25000) return 'Platinum';
    if (volume >= 5000) return 'Gold';
    if (volume >= 1000) return 'Silver';
    return 'Bronze';
}

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ElementType;
    accent?: boolean;
    subtext?: string;
}

function StatCard({ title, value, icon: Icon, accent, subtext }: StatCardProps) {
    return (
        <Card className={`transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${accent ? 'border-blue-600/30 bg-gradient-to-br from-blue-900/40 to-card' : ''}`}>
            <CardContent className="p-5">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">{title}</p>
                        <p className={`text-xl font-bold truncate ${accent ? 'text-brand-gradient' : ''}`}>{value}</p>
                        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
                    </div>
                    <div className={`ml-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-blue-600/20' : 'bg-secondary'}`}>
                        <Icon className={`h-5 w-5 ${accent ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function CycleCard({ cycle }: { cycle: Cycle }) {
    const pct = progressPct(cycle.daysAccrued, cycle.durationDays);
    const dl = daysLeft(cycle.endsAt);
    const tierColor: Record<string, string> = {
        STARTER: 'brand',
        PRO: 'info',
        ELITE: 'success',
    };

    return (
        <Card className="hover:border-border/80 transition-colors">
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Badge variant={tierColor[cycle.tier] as any}>{cycle.tier}</Badge>
                        <span className="text-xs text-muted-foreground">{roiPercent(cycle.dailyRoiBps)}/day</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{dl}d left</span>
                </div>
                <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Principal</span>
                        <span className="font-medium">{formatUSDT(cycle.principal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Earned so far</span>
                        <span className="font-medium text-cyan-400">{formatUSDT(cycle.totalAccrued)}</span>
                    </div>
                </div>
                <Progress value={pct} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                    <span>Day {cycle.daysAccrued} / {cycle.durationDays}</span>
                    <span>{pct}%</span>
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
        <Card className="bg-gradient-to-br from-blue-600/10 to-blue-900/5 my-6 border-blue-600/20 shadow-inner relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-5 relative z-10 gap-4">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="bg-blue-600/20 p-2.5 rounded-lg border border-blue-600/30 flex-shrink-0">
                        <Clock className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground flex items-center gap-2">
                            Next Earnings Distribution
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                            </span>
                        </h3>
                        <p className="text-muted-foreground text-sm mt-0.5">ROI is distributed daily directly to your withdrawable balance.</p>
                    </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 self-start sm:self-center">
                    {parts.map((p, i) => (
                        <div key={i} className="flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm border border-blue-600/20 rounded-md px-3 h-14 shadow-sm min-w-14">
                            {p === 'Processing...' ? (
                                <span className="text-sm font-bold text-blue-600">{p}</span>
                            ) : (
                                <>
                                    <span className="text-xl font-bold text-blue-600 tabular-nums">{p.slice(0, 2)}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase font-medium">{p.slice(2)}</span>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </Card>
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
    const rank = getRankStatus(parseFloat(d.teamVolume || '0'));

    const stats = [
        { title: 'Withdrawable Balance', value: formatUSDT(d.withdrawableBalance), icon: Wallet, accent: true, subtext: 'Available to withdraw now' },
        { title: 'Locked Capital', value: formatUSDT(d.lockedCapital), icon: Lock, subtext: 'Released when cycles complete' },
        { title: "Today's Earnings", value: formatUSDT(d.dailyEarningsToday), icon: Zap, subtext: 'ROI accrued today' },
        { title: 'Total Earnings', value: formatUSDT(d.totalRoiEarned), icon: TrendingUp, subtext: 'All-time ROI returns' },
        { title: 'Active Cycles', value: String(d.activeCycleCount), icon: RefreshCw, subtext: 'Running investment cycles' },
        { title: 'Referral Earnings', value: formatUSDT(d.referralEarnings), icon: Users, subtext: `Commissions from network` },
        { title: 'Team Volume', value: formatUSDT(d.teamVolume), icon: Target, subtext: 'Total downline deposits' },
        { title: 'Rank Status', value: rank, icon: Award, subtext: 'Based on team volume' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Welcome back{user?.username ? `, ${user.username}` : ''}! 👋
                    </h1>
                    <p className="text-muted-foreground mt-1 text-base">Here is your investment overview for today.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
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

            <CountdownBanner activeCycles={d.activeCycles} />

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {stats.map((s) => (
                    <StatCard key={s.title} {...s} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active cycles column (takes up 2 cols on lg) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-cyan-400" />
                            <h2 className="text-lg font-semibold tracking-tight">Active Cycles</h2>
                        </div>
                        <Button variant="ghost" size="sm" asChild className="hover:text-cyan-400 transition-colors">
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
                    { to: '/referrals', icon: Users, label: 'Referrals', desc: 'Invite & earn 12%' },
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
