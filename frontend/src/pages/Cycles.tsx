import { useQuery } from '@tanstack/react-query';
import { api, type Cycle } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatUSDT, formatDate, roiPercent, daysLeft, progressPct } from '@/lib/utils';
import { Loader2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

const tierColor: Record<string, any> = { STARTER: 'gold', PRO: 'info', ELITE: 'success' };

function CycleCard({ cycle }: { cycle: Cycle }) {
    const pct = progressPct(cycle.daysAccrued, cycle.durationDays);
    const dl = daysLeft(cycle.endsAt);
    const isActive = cycle.status === 'ACTIVE';

    return (
        <Card className={`transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${isActive ? 'border-amber-500/20' : ''}`}>
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
                            <div className="flex items-center gap-1 text-xs text-amber-400">
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
                        <p className="font-semibold text-amber-400">{formatUSDT(cycle.totalAccrued)}</p>
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
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Investment Cycles</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Track your capital lock-up and daily ROI progress</p>
            </div>

            {/* Summary bar */}
            {data && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Active', count: active.length, color: 'text-amber-400' },
                        { label: 'Completed', count: completed.length, color: 'text-emerald-400' },
                        { label: 'Cancelled', count: cancelled.length, color: 'text-muted-foreground' },
                    ].map(({ label, count, color }) => (
                        <Card key={label}>
                            <CardContent className="p-4 text-center">
                                <p className={`text-2xl font-bold ${color}`}>{count}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
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
