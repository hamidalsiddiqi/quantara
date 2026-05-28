import { useQuery } from '@tanstack/react-query';
import { api, type Cycle } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
    TrendingUp, Wallet, Lock, Zap, Users, BarChart3,
    ArrowRight, RefreshCw, Loader2,
} from 'lucide-react';
import { formatUSDT, formatDate, roiPercent, daysLeft, progressPct } from '@/lib/utils';

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ElementType;
    accent?: boolean;
    subtext?: string;
}

function StatCard({ title, value, icon: Icon, accent, subtext }: StatCardProps) {
    return (
        <Card className={`transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${accent ? 'border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-card' : ''}`}>
            <CardContent className="p-5">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">{title}</p>
                        <p className={`text-xl font-bold truncate ${accent ? 'text-gold-gradient' : ''}`}>{value}</p>
                        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
                    </div>
                    <div className={`ml-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-amber-500/20' : 'bg-secondary'}`}>
                        <Icon className={`h-5 w-5 ${accent ? 'text-amber-400' : 'text-muted-foreground'}`} />
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
        STARTER: 'gold',
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
                        <span className="font-medium text-amber-400">{formatUSDT(cycle.totalAccrued)}</span>
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

export default function Dashboard() {
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
    const stats = [
        { title: 'Withdrawable Balance', value: formatUSDT(d.withdrawableBalance), icon: Wallet, accent: true, subtext: 'Available to withdraw now' },
        { title: 'Locked Capital', value: formatUSDT(d.lockedCapital), icon: Lock, subtext: 'Released when cycles complete' },
        { title: "Today's Earnings", value: formatUSDT(d.dailyEarningsToday), icon: Zap, subtext: 'ROI accrued today' },
        { title: 'Total ROI Earned', value: formatUSDT(d.totalRoiEarned), icon: TrendingUp, subtext: 'All-time returns' },
        { title: 'Active Cycles', value: String(d.activeCycleCount), icon: RefreshCw, subtext: 'Running investment cycles' },
        { title: 'Referral Earnings', value: formatUSDT(d.referralEarnings), icon: Users, subtext: `Team volume: ${formatUSDT(d.teamVolume)}` },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Your investment overview</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link to="/deposit">
                            <ArrowRight className="h-4 w-4" />
                            Deposit
                        </Link>
                    </Button>
                    <Button variant="gold" size="sm" asChild>
                        <Link to="/withdraw">Withdraw</Link>
                    </Button>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {stats.map((s) => (
                    <StatCard key={s.title} {...s} />
                ))}
            </div>

            {/* Active cycles */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                        <h2 className="text-lg font-semibold">Active Cycles</h2>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                        <Link to="/cycles" className="flex items-center gap-1">
                            View all <ArrowRight className="h-3 w-3" />
                        </Link>
                    </Button>
                </div>

                {d.activeCycles.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <RefreshCw className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
                            <p className="text-muted-foreground font-medium">No active cycles</p>
                            <p className="text-sm text-muted-foreground mt-1 mb-4">Deposit USDT to start earning daily ROI</p>
                            <Button variant="gold" size="sm" asChild>
                                <Link to="/deposit">Make a Deposit</Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {d.activeCycles.map((cycle) => (
                            <CycleCard key={cycle.id} cycle={cycle} />
                        ))}
                    </div>
                )}
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
