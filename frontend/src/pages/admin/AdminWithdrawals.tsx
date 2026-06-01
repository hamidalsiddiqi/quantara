import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatUSDT, formatDate, shortAddress } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Loader2, ArrowUpFromLine, RotateCcw } from 'lucide-react';

const statusMap: Record<string, { label: string; variant: any }> = {
    PENDING: { label: 'Pending', variant: 'warning' },
    SIGNED: { label: 'Signed', variant: 'info' },
    BROADCAST: { label: 'Broadcast', variant: 'info' },
    CONFIRMED: { label: 'Confirmed', variant: 'success' },
    FAILED: { label: 'Failed', variant: 'destructive' },
};

function WithdrawalTable({ status }: { status?: string }) {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ['admin-withdrawals', status],
        queryFn: () => api.admin.withdrawals(status),
        refetchInterval: 15_000,
    });

    const retryMutation = useMutation({
        mutationFn: api.admin.retryWithdrawal,
        onSuccess: () => {
            toast({ title: 'Withdrawal queued for retry', variant: 'success' });
            qc.invalidateQueries({ queryKey: ['admin-withdrawals'] });
        },
        onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
    });

    if (isLoading) return (
        <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    );

    const items = data?.items ?? [];
    if (items.length === 0) return (
        <p className="text-center text-sm text-muted-foreground py-10">No withdrawals found</p>
    );

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>To Address</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Tx Hash</TableHead>
                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                    <TableHead>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items.map((w) => {
                    const s = statusMap[w.status] ?? { label: w.status, variant: 'outline' };
                    return (
                        <TableRow key={w.id}>
                            <TableCell>
                                <div>
                                    <p className="font-medium text-sm">{w.user.username}</p>
                                    <p className="text-xs text-muted-foreground">{w.user.email}</p>
                                </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{shortAddress(w.toAddress)}</TableCell>
                            <TableCell className="font-medium">{formatUSDT(w.amount)}</TableCell>
                            <TableCell>
                                <div>
                                    <Badge variant={s.variant}>{s.label}</Badge>
                                    {w.error && <p className="text-xs text-destructive mt-1 max-w-[150px] truncate">{w.error}</p>}
                                </div>
                            </TableCell>
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
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{formatDate(w.createdAt)}</TableCell>
                            <TableCell>
                                {w.status === 'FAILED' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1"
                                        disabled={retryMutation.isPending}
                                        onClick={() => retryMutation.mutate(w.id)}
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                        Retry
                                    </Button>
                                )}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}

export default function AdminWithdrawals() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
                    <ArrowUpFromLine className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Withdrawals</h1>
                    <p className="text-sm text-muted-foreground">Monitor and manage withdrawal requests</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Withdrawal Queue</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="all">
                        <TabsList>
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="pending">Pending</TabsTrigger>
                            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
                            <TabsTrigger value="failed">Failed</TabsTrigger>
                        </TabsList>
                        <TabsContent value="all"><WithdrawalTable /></TabsContent>
                        <TabsContent value="pending"><WithdrawalTable status="PENDING" /></TabsContent>
                        <TabsContent value="confirmed"><WithdrawalTable status="CONFIRMED" /></TabsContent>
                        <TabsContent value="failed"><WithdrawalTable status="FAILED" /></TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
