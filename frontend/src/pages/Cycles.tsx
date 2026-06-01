import { useQuery } from '@tanstack/react-query';
import { api, type Cycle } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatUSDT, formatDate, roiPercent, daysLeft, progressPct } from '@/lib/utils';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Zap, Shield, Crown, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const tierColor: Record<string, any> = { STARTER: 'brand', PRO: 'info', ELITE: 'success' };

function CycleCard({ cycle }: { cycle: Cycle }) {
    const pct = progressPct(cycle.daysAccrued, cycle.durationDays);
    const dl = daysLeft(cycle.endsAt);
    const isActive = cycle.status === 'ACTIVE';

    return (
        <Card className={`transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${isActive ? 'border-blue-600/20' : ''}`}>
            <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant={tierColor[cycle.tier]}>{cycle.tier}</Badge>
                            <span className="text-xs text-muted-foreground">{roiPercent(cycle.dailyRoiBps)}/day</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Started {formatDate(cycle.startedAt)}</p>
                    </div>
                    <div className="text-right">
                        {cycle.status === 'ACTIVE' && (
                            <div className="flex items-center gap-1 text-xs text-cyan-400">
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                Active
                            </div>
                        )}
                        {cycle.status === 'COMPLETED' && (
                            <div className="flex items-center gap-1 text-xs text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" />
                                Completed
                            </div>
                        )}
                        {cycle.status === 'CANCELLED' && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <XCircle className="h-3 w-3" />
                                Cancelled
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                    <div>
                        <p className="text-xs text-muted-foreground">Principal</p>
                        <p className="font-semibold">{formatUSDT(cycle.principal)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Total Earned</p>
                        <p className="font-semibold text-cyan-400">{formatUSDT(cycle.totalAccrued)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="font-semibold">{cycle.durationDays} days</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">{isActive ? 'Days Left' : 'Ended'}</p>
                        <p className="font-semibold">{isActive ? `${dl} days` : formatDate(cycle.endsAt)}</p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Progress value={pct} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Day {cycle.daysAccrued} / {cycle.durationDays}</span>
                        <span>{pct}% complete</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function PremiumPlanCards() {
    const { data, isLoading } = useQuery({
        queryKey: ['tiers'],
        queryFn: api.cycles.tiers,
    });

    if (isLoading || !data) return null;

    const tiers = [
        { id: 'STARTER', data: data.tiers.STARTER, icon: Shield, color: 'text-blue-200', bg: 'bg-blue-900/40', border: 'border-blue-600/20' },
        { id: 'PRO', data: data.tiers.PRO, icon: Zap, color: 'text-cyan-400', bg: 'bg-gradient-to-b from-blue-600/20 to-blue-900/40', border: 'border-cyan-400/50', popular: true },
        { id: 'ELITE', data: data.tiers.ELITE, icon: Crown, color: 'text-cyan-400', bg: 'bg-blue-900/60', border: 'border-blue-600/30' },
    ];

    return (
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-6">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center justify-center gap-2">
                    <Crown className="h-6 w-6 text-cyan-400" /> Premium Plans
                </h2>
                <p className="text-sm text-muted-foreground">Select a plan to start compounding your wealth</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {tiers.map((tier) => (
                    <Card key={tier.id} className={`relative flex flex-col group transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${tier.border} ${tier.bg}`}>
                        {tier.popular && (
                            <div className="absolute -top-3 inset-x-0 mx-auto w-fit">
                                <Badge variant="brand" className="px-3 py-1 text-[10px] shadow-lg">Most Popular</Badge>
                            </div>
                        )}
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto mb-2 p-3 bg-background/50 rounded-xl w-fit border border-border/50 group-hover:scale-110 transition-transform">
                                <tier.icon className={`h-6 w-6 ${tier.color}`} />
                            </div>
                            <CardTitle className="text-xl font-bold tracking-tight">{tier.id}</CardTitle>
                            <div className="mt-2 flex items-baseline justify-center gap-1">
                                <span className="text-3xl font-extrabold text-white">{roiPercent(tier.data.dailyRoiBps)}</span>
                                <span className="text-sm text-muted-foreground">/day</span>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <ul className="space-y-3 text-sm mt-4">
                                <li className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Duration</span>
                                    <span className="font-semibold">{tier.data.durationDays} Days</span>
                                </li>
                                <li className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Min Deposit</span>
                                    <span className="font-semibold">{tier.data.min} USDT</span>
                                </li>
                                <li className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Max Deposit</span>
                                    <span className="font-semibold">{tier.data.max === -1 ? 'Unlimited' : `${tier.data.max} USDT`}</span>
                                </li>
                            </ul>
                        </CardContent>
                        <CardFooter className="pt-2 pb-6 px-6">
                            <Button className="w-full group/btn" variant={tier.popular ? 'brand' : 'secondary'} asChild>
                                <Link to="/deposit">
                                    Select {tier.id}
                                    <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}

export default function Cycles() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['cycles'],
        queryFn: api.cycles.list,
        refetchInterval: 30_000,
    });

    const active = data?.items.filter((c) => c.status === 'ACTIVE') ?? [];
    const completed = data?.items.filter((c) => c.status === 'COMPLETED') ?? [];
    const cancelled = data?.items.filter((c) => c.status === 'CANCELLED') ?? [];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Investment Cycles</h1>
                    <p className="text-base text-muted-foreground mt-1">Track your capital lock-up and daily ROI progress</p>
                </div>
                <Button variant="brand" size="sm" asChild>
                    <Link to="/deposit">Start New Cycle</Link>
                </Button>
            </div>

            <PremiumPlanCards />

            {/* Summary bar */}
            {data && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Active Cycles', count: active.length, color: 'text-cyan-400' },
                        { label: 'Completed', count: completed.length, color: 'text-emerald-400' },
                        { label: 'Cancelled', count: cancelled.length, color: 'text-muted-foreground' },
                    ].map(({ label, count, color }) => (
                        <Card key={label} className="bg-card/40 backdrop-blur-md border-border/50">
                            <CardContent className="p-5 text-center flex flex-col items-center justify-center">
                                <p className={`text-3xl font-bold ${color} tabular-nums tracking-tight`}>{count}</p>
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-1.5">{label}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {isLoading && (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive text-sm">
                    Failed to load cycles. Please refresh.
                </div>
            )}

            {data && (
                <Tabs defaultValue="active">
                    <TabsList className="w-full sm:w-auto">
                        <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
                        <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
                        <TabsTrigger value="cancelled">Cancelled ({cancelled.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="active">
                        {active.length === 0 ? (
                            <Card className="border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                    <RefreshCw className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
                                    <p className="text-muted-foreground">No active cycles</p>
                                    <p className="text-sm text-muted-foreground mt-1">Deposit USDT to start a cycle</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {active.map((c) => <CycleCard key={c.id} cycle={c} />)}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="completed">
                        {completed.length === 0 ? (
                            <Card className="border-dashed">
                                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                                    No completed cycles yet
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {completed.map((c) => <CycleCard key={c.id} cycle={c} />)}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="cancelled">
                        {cancelled.length === 0 ? (
                            <Card className="border-dashed">
                                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                                    No cancelled cycles
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {cancelled.map((c) => <CycleCard key={c.id} cycle={c} />)}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
