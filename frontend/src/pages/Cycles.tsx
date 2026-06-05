import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Cycle, type TierConfig } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { formatUSDT, formatDate, roiPercent, daysLeft, progressPct } from '@/lib/utils';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Zap, Shield, Crown, ArrowRight, Wallet, AlertTriangle, X } from 'lucide-react';
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

/// Client-side mirror of the backend tier selection (selectTier) so the dialog
/// can preview which tier an amount lands in before submitting.
function previewTier(amount: number, tiers: TierConfig): 'STARTER' | 'PRO' | 'ELITE' | null {
    if (amount >= tiers.ELITE.min) return 'ELITE';
    if (amount >= tiers.PRO.min && amount <= tiers.PRO.max) return 'PRO';
    if (amount >= tiers.STARTER.min && amount <= tiers.STARTER.max) return 'STARTER';
    return null;
}

function BuyWithBalanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const qc = useQueryClient();
    const [amount, setAmount] = useState('');
    const [formError, setFormError] = useState('');

    const { data: balanceData, isLoading: balLoading } = useQuery({
        queryKey: ['withdraw-balance'],
        queryFn: api.withdraw.balance,
        enabled: open,
    });

    const { data: tiersData } = useQuery({
        queryKey: ['tiers'],
        queryFn: api.cycles.tiers,
        enabled: open,
    });

    const mutation = useMutation({
        mutationFn: api.cycles.buy,
        onSuccess: (res) => {
            toast({ title: `${res.tier} cycle started!`, variant: 'success' });
            setAmount('');
            setFormError('');
            qc.invalidateQueries({ queryKey: ['cycles'] });
            qc.invalidateQueries({ queryKey: ['withdraw-balance'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            onClose();
        },
        onError: (err: any) => setFormError(err.message ?? 'Purchase failed'),
    });

    if (!open) return null;

    const withdrawable = parseFloat(balanceData?.withdrawable ?? '0');
    const amt = parseFloat(amount);
    const tier = !isNaN(amt) && tiersData ? previewTier(amt, tiersData.tiers) : null;
    const tierCfg = tier && tiersData ? tiersData.tiers[tier] : null;

    function setMax() {
        if (balanceData?.withdrawable) setAmount(parseFloat(balanceData.withdrawable).toFixed(4));
    }

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setFormError('');
        if (isNaN(amt) || amt <= 0) {
            setFormError('Enter a valid amount greater than 0');
            return;
        }
        if (!tier) {
            setFormError(`Amount does not match any tier (minimum: ${tiersData?.tiers.STARTER.min ?? 20} USDT)`);
            return;
        }
        if (amt > withdrawable) {
            setFormError('Amount exceeds your withdrawable balance');
            return;
        }
        mutation.mutate({ amount: String(amt) });
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
            <Card className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Wallet className="h-4 w-4" /> Buy Cycle with Balance
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">Fund a new cycle from your withdrawable balance</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 rounded-xl border border-blue-600/20 bg-gradient-to-br from-blue-900/40 to-card p-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Withdrawable Balance</p>
                        {balLoading ? (
                            <div className="h-7 w-32 shimmer-bg rounded" />
                        ) : (
                            <p className="text-2xl font-bold text-brand-gradient">{formatUSDT(balanceData?.withdrawable ?? '0')}</p>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {formError && (
                            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex gap-2">
                                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                {formError}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="buy-amount">Amount (USDT)</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="buy-amount"
                                    type="number"
                                    step="0.0001"
                                    min="0.0001"
                                    placeholder="0.0000"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                />
                                <Button type="button" variant="outline" size="sm" onClick={setMax} className="flex-shrink-0">
                                    MAX
                                </Button>
                            </div>
                            {!isNaN(amt) && amt > withdrawable && (
                                <p className="text-xs text-destructive">Exceeds available balance</p>
                            )}
                        </div>

                        {tier && tierCfg && (
                            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Tier</span>
                                    <Badge variant={tierColor[tier]}>{tier}</Badge>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Daily ROI</span>
                                    <span className="font-medium text-foreground">{roiPercent(tierCfg.dailyRoiBps)}/day</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Duration</span>
                                    <span className="font-medium text-foreground">{tierCfg.durationDays} days</span>
                                </div>
                            </div>
                        )}

                        <Button
                            type="submit"
                            variant="brand"
                            className="w-full"
                            disabled={mutation.isPending || withdrawable === 0}
                        >
                            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            {mutation.isPending ? 'Purchasing…' : 'Buy Cycle'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
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
    const [buyOpen, setBuyOpen] = useState(false);
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
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setBuyOpen(true)}>
                        <Wallet className="h-4 w-4 mr-1.5" />
                        Buy with Balance
                    </Button>
                    <Button variant="brand" size="sm" asChild>
                        <Link to="/deposit">Start New Cycle</Link>
                    </Button>
                </div>
            </div>

            <BuyWithBalanceDialog open={buyOpen} onClose={() => setBuyOpen(false)} />

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
