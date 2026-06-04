import { useState, useEffect, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatUSDT, formatDate, shortAddress } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Wallet, AlertTriangle, Info, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth';

/// Format milliseconds remaining as "Hh Mm Ss".
function formatCountdown(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}h ${m}m ${s}s`;
}

const withdrawStatusMap: Record<string, { label: string; variant: any }> = {
    PENDING: { label: 'Pending', variant: 'warning' },
    SIGNED: { label: 'Signed', variant: 'info' },
    BROADCAST: { label: 'Broadcast', variant: 'info' },
    CONFIRMED: { label: 'Confirmed', variant: 'success' },
    FAILED: { label: 'Failed', variant: 'destructive' },
};

export default function Withdraw() {
    const { user } = useAuth();
    const qc = useQueryClient();

    const [amount, setAmount] = useState('');
    const [toAddress, setToAddress] = useState(user?.bscWithdrawAddress ?? '');
    const [formError, setFormError] = useState('');

    const { data: balanceData, isLoading: balLoading } = useQuery({
        queryKey: ['withdraw-balance'],
        queryFn: api.withdraw.balance,
        refetchInterval: 15_000,
    });

    const { data: historyData, isLoading: histLoading } = useQuery({
        queryKey: ['withdraw-history'],
        queryFn: api.withdraw.history,
        refetchInterval: 15_000,
    });

    const mutation = useMutation({
        mutationFn: api.withdraw.submit,
        onSuccess: () => {
            toast({ title: 'Withdrawal request submitted!', variant: 'success' });
            setAmount('');
            qc.invalidateQueries({ queryKey: ['withdraw-balance'] });
            qc.invalidateQueries({ queryKey: ['withdraw-history'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
        onError: (err: any) => {
            setFormError(err.message ?? 'Withdrawal failed');
            // A 429 means the daily limit was hit — refresh so the countdown shows.
            qc.invalidateQueries({ queryKey: ['withdraw-balance'] });
        },
    });

    function setMax() {
        if (balanceData?.withdrawable) setAmount(parseFloat(balanceData.withdrawable).toFixed(4));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setFormError('');
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0) {
            setFormError('Enter a valid amount greater than 0');
            return;
        }
        if (!toAddress.startsWith('0x') || toAddress.length !== 42) {
            setFormError('Enter a valid BSC wallet address (0x...)');
            return;
        }
        const next = balanceData?.nextWithdrawalAt;
        if (next && new Date(next).getTime() > Date.now()) {
            setFormError('You can only submit one withdrawal request every 24 hours.');
            return;
        }
        mutation.mutate({ toAddress, amount: String(amt) });
    }

    const withdrawable = parseFloat(balanceData?.withdrawable ?? '0');
    const feeBps = balanceData?.feeBps ?? 0;
    const feePct = feeBps / 100;
    const amt = parseFloat(amount);
    const showQuote = !isNaN(amt) && amt > 0 && feeBps > 0;
    const feeAmount = showQuote ? (amt * feeBps) / 10000 : 0;
    const netAmount = showQuote ? amt - feeAmount : 0;

    // Live countdown until the next withdrawal is allowed (one request per 24h).
    const nextWithdrawalAt = balanceData?.nextWithdrawalAt ?? null;
    const [now, setNow] = useState(() => Date.now());
    const nextMs = nextWithdrawalAt ? new Date(nextWithdrawalAt).getTime() : 0;
    const cooldownRemaining = nextMs - now;
    const onCooldown = cooldownRemaining > 0;

    useEffect(() => {
        if (!onCooldown) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [onCooldown]);

    // When the countdown elapses, refresh balance so the server lifts the lock.
    useEffect(() => {
        if (nextWithdrawalAt && !onCooldown) {
            qc.invalidateQueries({ queryKey: ['withdraw-balance'] });
        }
    }, [onCooldown, nextWithdrawalAt, qc]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Withdraw USDT</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Withdraw your earnings to any BSC wallet</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Withdraw form */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Request Withdrawal</CardTitle>
                            <CardDescription>Funds are sent on-chain automatically</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Balance display */}
                            <div className="mb-5 rounded-xl border border-blue-600/20 bg-gradient-to-br from-blue-900/40 to-card p-4">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Available to Withdraw</p>
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
                                    <Label htmlFor="amount">Amount (USDT)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="amount"
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
                                    {withdrawable > 0 && amount && parseFloat(amount) > withdrawable && (
                                        <p className="text-xs text-destructive">Exceeds available balance</p>
                                    )}
                                </div>

                                {showQuote && (
                                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm space-y-1">
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>Withdrawal fee ({feePct}%)</span>
                                            <span>−{formatUSDT(feeAmount)}</span>
                                        </div>
                                        <div className="flex justify-between font-medium border-t border-border pt-1 mt-1">
                                            <span>You receive</span>
                                            <span className="text-brand-gradient">{formatUSDT(netAmount)}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="toAddress">BSC Payout Address</Label>
                                    <Input
                                        id="toAddress"
                                        type="text"
                                        placeholder="0x..."
                                        value={toAddress}
                                        onChange={(e) => setToAddress(e.target.value)}
                                        required
                                        className="font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">Must be a valid BEP-20 compatible wallet address</p>
                                </div>

                                {onCooldown ? (
                                    <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300/90">
                                        <Clock className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <span>
                                            Only one withdrawal request is allowed every 24 hours. Next request available in{' '}
                                            <span className="font-semibold tabular-nums">{formatCountdown(cooldownRemaining)}</span>.
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-300/80">
                                        <Info className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                                        Withdrawals are processed automatically. You can submit one request every 24 hours.
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    variant="brand"
                                    className="w-full"
                                    disabled={mutation.isPending || withdrawable === 0 || onCooldown}
                                >
                                    {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {mutation.isPending
                                        ? 'Submitting…'
                                        : onCooldown
                                            ? `Available in ${formatCountdown(cooldownRemaining)}`
                                            : 'Request Withdrawal'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Info card */}
                <div>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Wallet className="h-4 w-4" />
                                How it Works
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-muted-foreground">
                            {[
                                { step: '1', text: 'Enter the amount and your BSC wallet address.' },
                                { step: '2', text: 'Your request is queued for processing.' },
                                { step: '3', text: 'Funds are signed and broadcast on BSC automatically.' },
                                { step: '4', text: 'You receive USDT in your wallet once confirmed.' },
                            ].map(({ step, text }) => (
                                <div key={step} className="flex gap-2.5">
                                    <div className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 font-semibold">{step}</div>
                                    <p>{text}</p>
                                </div>
                            ))}
                            <div className="pt-2 border-t border-border">
                                <p className="text-xs">Only ROI profits and completed cycle principals are withdrawable. Locked capital is released when a cycle completes.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Withdrawal history */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Withdrawal History</CardTitle>
                </CardHeader>
                <CardContent>
                    {histLoading && (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {!histLoading && (!historyData?.items || historyData.items.length === 0) && (
                        <p className="text-center text-sm text-muted-foreground py-8">No withdrawals yet</p>
                    )}
                    {historyData && historyData.items.length > 0 && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>To Address</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead className="hidden sm:table-cell">Fee</TableHead>
                                    <TableHead>Received</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="hidden md:table-cell">Tx Hash</TableHead>
                                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {historyData.items.map((w) => {
                                    const s = withdrawStatusMap[w.status] ?? { label: w.status, variant: 'outline' };
                                    return (
                                        <TableRow key={w.id}>
                                            <TableCell className="font-mono text-xs">{shortAddress(w.toAddress)}</TableCell>
                                            <TableCell className="font-medium">{formatUSDT(w.amount)}</TableCell>
                                            <TableCell className="hidden sm:table-cell text-muted-foreground">{formatUSDT(w.fee)}</TableCell>
                                            <TableCell className="font-medium">{formatUSDT(w.netAmount)}</TableCell>
                                            <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                {w.txHash ? (
                                                    <a
                                                        href={`https://bscscan.com/tx/${w.txHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-mono text-xs text-primary hover:underline"
                                                    >
                                                        {shortAddress(w.txHash)}
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{formatDate(w.createdAt)}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
