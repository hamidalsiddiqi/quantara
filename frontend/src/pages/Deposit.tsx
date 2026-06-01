import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, CheckCircle, Loader2, AlertTriangle, Clock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatUSDT, formatDate, shortAddress } from '@/lib/utils';
import { useState } from 'react';
import { toast } from '@/components/ui/use-toast';

const depositStatusMap: Record<string, { label: string; variant: any }> = {
    PENDING: { label: 'Pending', variant: 'warning' },
    CONFIRMED: { label: 'Confirmed', variant: 'info' },
    CREDITED: { label: 'Credited', variant: 'success' },
    FAILED: { label: 'Failed', variant: 'destructive' },
};

const TIERS = [
    { tier: 'Starter', range: '20 – 999 USDT', roi: '1.50%/day', days: '30 days', color: 'text-cyan-400' },
    { tier: 'Pro', range: '1,000 – 4,999 USDT', roi: '1.80%/day', days: '45 days', color: 'text-blue-400' },
    { tier: 'Elite', range: '5,000+ USDT', roi: '2.00%/day', days: '60 days', color: 'text-emerald-400' },
];

export default function Deposit() {
    const qc = useQueryClient();
    const [copied, setCopied] = useState(false);
    const [txHashInput, setTxHashInput] = useState('');

    const verifyMutation = useMutation({
        mutationFn: (txHash: string) => api.deposit.verify({ txHash }),
        onSuccess: (data) => {
            toast({ title: 'Deposit verified successfully!', description: `Credited ${data.amount} USDT.`, variant: 'success' });
            setTxHashInput('');
            qc.invalidateQueries({ queryKey: ['deposit-history'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        },
        onError: (err: any) => {
            toast({ title: 'Verification failed', description: err.message, variant: 'destructive' });
        }
    });

    function handleVerify(e: React.FormEvent) {
        e.preventDefault();
        const hash = txHashInput.trim();
        if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
            toast({ title: 'Invalid Hash', description: 'Please enter a valid BSC transaction hash (0x...).', variant: 'destructive' });
            return;
        }
        verifyMutation.mutate(hash);
    }

    const { data: addrData, isLoading: addrLoading, error: addrError } = useQuery({
        queryKey: ['deposit-address'],
        queryFn: api.deposit.address,
    });

    const { data: historyData, isLoading: histLoading } = useQuery({
        queryKey: ['deposit-history'],
        queryFn: api.deposit.history,
        refetchInterval: 15_000,
    });

    function copyAddress() {
        if (!addrData?.address) return;
        navigator.clipboard.writeText(addrData.address);
        setCopied(true);
        toast({ title: 'Address copied!', variant: 'success' });
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Deposit USDT</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Fund your account on BSC to start earning</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Deposit address card */}
                <div className="lg:col-span-2 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Your Deposit Address</CardTitle>
                            <CardDescription>Send USDT (BEP-20) on BSC network only</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {addrLoading && (
                                <div className="flex items-center justify-center py-10">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            )}
                            {addrError && (
                                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 flex gap-2 text-destructive text-sm">
                                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                    Failed to load deposit address. Please refresh.
                                </div>
                            )}
                            {addrData && (
                                <div className="space-y-5">
                                    {/* QR + address */}
                                    <div className="flex flex-col sm:flex-row items-center gap-5">
                                        <div className="p-3 rounded-xl bg-white flex-shrink-0 shadow-lg">
                                            <QRCodeSVG value={addrData.address} size={140} />
                                        </div>
                                        <div className="flex-1 min-w-0 w-full space-y-3">
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-1.5">BSC Wallet Address</p>
                                                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-3">
                                                    <code className="flex-1 text-xs sm:text-sm font-mono break-all">{addrData.address}</code>
                                                    <Button size="icon" variant="ghost" className="flex-shrink-0 h-8 w-8" onClick={copyAddress}>
                                                        {copied ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="rounded-lg bg-secondary/40 p-2.5">
                                                    <p className="text-muted-foreground">Network</p>
                                                    <p className="font-semibold mt-0.5">BSC (BEP-20)</p>
                                                </div>
                                                <div className="rounded-lg bg-secondary/40 p-2.5">
                                                    <p className="text-muted-foreground">Token</p>
                                                    <p className="font-semibold mt-0.5">{addrData.token}</p>
                                                </div>
                                                <div className="rounded-lg bg-secondary/40 p-2.5">
                                                    <p className="text-muted-foreground">Min Confirmations</p>
                                                    <p className="font-semibold mt-0.5">{addrData.minConfirmations}</p>
                                                </div>
                                                <div className="rounded-lg bg-secondary/40 p-2.5">
                                                    <p className="text-muted-foreground">Chain ID</p>
                                                    <p className="font-semibold mt-0.5">{addrData.chainId}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Warning */}
                                    <div className="flex gap-2.5 rounded-lg border border-blue-600/30 bg-blue-600/10 p-3 text-sm">
                                        <AlertTriangle className="h-4 w-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                                        <div className="text-blue-200/80">
                                            <strong className="text-cyan-400">Important:</strong> Send only <strong>USDT BEP-20</strong> on the BSC network.
                                            Sending any other token or using a different network will result in permanent loss of funds.
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-sm">
                                        <h3 className="text-sm font-semibold flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-primary" />
                                            Verify Deposit Manually
                                        </h3>
                                        <p className="text-xs text-muted-foreground">
                                            After sending USDT, paste the transaction hash here to verify and credit your deposit immediately. Requirements: BEP-20 USDT, sent to your address above, and fully confirmed.
                                        </p>
                                        <form onSubmit={handleVerify} className="flex gap-2">
                                            <Input
                                                placeholder="0x..."
                                                value={txHashInput}
                                                onChange={(e) => setTxHashInput(e.target.value)}
                                                className="flex-1 font-mono text-xs"
                                                disabled={verifyMutation.isPending}
                                            />
                                            <Button type="submit" variant="brand" disabled={verifyMutation.isPending}>
                                                {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify Tx'}
                                            </Button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Tier guide */}
                <div>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-base">Investment Tiers</CardTitle>
                            <CardDescription>Auto-assigned by deposit amount</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {TIERS.map((t) => (
                                <div key={t.tier} className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-sm">{t.tier}</span>
                                        <span className={`text-sm font-bold ${t.color}`}>{t.roi}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t.range}</p>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {t.days} lock period
                                    </div>
                                </div>
                            ))}
                            <p className="text-xs text-muted-foreground pt-1">
                                Capital unlocked after lock period. Profits withdrawable anytime.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Deposit history */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Deposit History</CardTitle>
                </CardHeader>
                <CardContent>
                    {histLoading && (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {!histLoading && (!historyData?.items || historyData.items.length === 0) && (
                        <p className="text-center text-sm text-muted-foreground py-8">No deposits yet</p>
                    )}
                    {historyData && historyData.items.length > 0 && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tx Hash</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Confirmations</TableHead>
                                    <TableHead className="hidden md:table-cell">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {historyData.items.map((d) => {
                                    const s = depositStatusMap[d.status] ?? { label: d.status, variant: 'outline' };
                                    return (
                                        <TableRow key={d.id}>
                                            <TableCell>
                                                <a
                                                    href={`https://bscscan.com/tx/${d.txHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-mono text-xs text-primary hover:underline"
                                                >
                                                    {shortAddress(d.txHash)}
                                                </a>
                                            </TableCell>
                                            <TableCell className="font-medium">{formatUSDT(d.amount)}</TableCell>
                                            <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                                            <TableCell>{d.confirmations}</TableCell>
                                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{formatDate(d.createdAt)}</TableCell>
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
