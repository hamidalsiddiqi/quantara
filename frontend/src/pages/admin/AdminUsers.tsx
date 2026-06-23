import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, AdminUser } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatDate, shortAddress, formatUSDT } from '@/lib/utils';
import { Loader2, Users, ShieldAlert, ShieldCheck, Coins, TrendingUp, ArrowDownToLine, X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function AdminUsers() {
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['admin-users'],
        queryFn: api.admin.users,
    });

    const handleAdjustBalance = async (u: AdminUser) => {
        const input = window.prompt(`Enter amount to ADD to ${u.username}'s balance. (Use negative for DEDUCT)`);
        if (!input) return;
        const val = parseFloat(input);
        if (isNaN(val)) return toast({ title: 'Invalid amount', variant: 'destructive' });
        const action = val >= 0 ? 'add' : 'deduct';
        const amount = Math.abs(val).toString();
        try {
            await api.admin.adjustBalance(u.id, action, amount);
            toast({ title: 'Success', description: 'Balance updated' });
            refetch();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        }
    };

    const handleAdjustProfit = async (u: AdminUser) => {
        const input = window.prompt(`Enter amount to ADD to ${u.username}'s total profits. (Use negative for DEDUCT)`);
        if (!input) return;
        const val = parseFloat(input);
        if (isNaN(val)) return toast({ title: 'Invalid amount', variant: 'destructive' });
        const action = val >= 0 ? 'add' : 'deduct';
        const amount = Math.abs(val).toString();
        try {
            await api.admin.adjustProfit(u.id, action, amount);
            toast({ title: 'Success', description: 'Profits updated' });
            refetch();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        }
    };

    const handleAddDeposit = async (u: AdminUser) => {
        const input = window.prompt(`Enter deposit amount (USDT) to credit for ${u.username}. This opens a cycle and pays referral commissions.`);
        if (!input) return;
        const val = parseFloat(input);
        if (isNaN(val) || val <= 0) return toast({ title: 'Invalid amount', variant: 'destructive' });
        try {
            const res = await api.admin.addDeposit(u.id, val.toString());
            toast({ title: 'Deposit credited', description: res.tier ? `Cycle opened (${res.tier})` : 'Recorded (below tier minimum, no cycle)' });
            refetch();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        }
    };

    const handleToggleBan = async (u: AdminUser) => {
        const willBan = !u.isBanned;
        if (!window.confirm(`Are you sure you want to ${willBan ? 'BAN' : 'UNBAN'} ${u.username}?`)) return;
        try {
            await api.admin.banUser(u.id, willBan);
            toast({ title: 'Success', description: `User ${willBan ? 'banned' : 'unbanned'}` });
            refetch();
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
                    <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Users</h1>
                    <p className="text-sm text-muted-foreground">All registered accounts</p>
                </div>
            </div>

            {isLoading && (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
                    Failed to load users.
                </div>
            )}

            {data && (
                <>
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Total Users', value: data.users.length },
                            { label: 'Admins', value: data.users.filter((u) => u.isAdmin).length },
                            { label: 'Banned', value: data.users.filter((u) => u.isBanned).length },
                            { label: 'Total Cycles', value: data.users.reduce((s, u) => s + u._count.cycles, 0) },
                        ].map(({ label, value }) => (
                            <Card key={label}>
                                <CardContent className="p-4">
                                    <p className="text-xl font-bold">{value}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">All Users ({data.users.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="hidden md:table-cell">Balance / Profit</TableHead>
                                        <TableHead>Cycles</TableHead>
                                        <TableHead className="hidden lg:table-cell">Deposits</TableHead>
                                        <TableHead className="hidden xl:table-cell">Joined</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.users.map((u) => (
                                        <TableRow
                                            key={u.id}
                                            onClick={() => setSelectedUserId(u.id)}
                                            className={`cursor-pointer hover:bg-muted/40 ${u.isBanned ? 'opacity-50' : ''}`}
                                        >
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-sm flex items-center gap-1.5">
                                                        {u.username}
                                                        {u.isAdmin && <Badge variant="warning" className="px-1 py-0 h-4 text-[9px]">ADMIN</Badge>}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">{u.email}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {u.isBanned
                                                    ? <Badge variant="destructive">Banned</Badge>
                                                    : <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">Active</Badge>
                                                }
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                                Bal: {formatUSDT(u.balance || '0')} <br />
                                                Prof: {formatUSDT(u.profit || '0')}
                                            </TableCell>
                                            <TableCell>{u._count.cycles}</TableCell>
                                            <TableCell className="hidden lg:table-cell">{u._count.deposits}</TableCell>
                                            <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                                                {formatDate(u.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                                                <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="Add Deposit (opens cycle + referrals)" onClick={() => handleAddDeposit(u)}>
                                                    <ArrowDownToLine className="h-3.5 w-3.5 text-amber-500" />
                                                </Button>
                                                <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="Adjust Balance" onClick={() => handleAdjustBalance(u)}>
                                                    <Coins className="h-3.5 w-3.5 text-cyan-500" />
                                                </Button>
                                                <Button variant="outline" size="sm" className="h-7 w-7 p-0" title="Adjust Profits" onClick={() => handleAdjustProfit(u)}>
                                                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                                </Button>
                                                <Button variant="outline" size="sm" className="h-7 w-7 p-0 hover:bg-destructive hover:text-white" title={u.isBanned ? "Unban" : "Ban"} onClick={() => handleToggleBan(u)}>
                                                    {u.isBanned ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            )}

            {selectedUserId && (
                <UserDetailDialog id={selectedUserId} onClose={() => setSelectedUserId(null)} />
            )}
        </div>
    );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={`text-base font-bold ${accent ?? ''}`}>{value}</p>
        </div>
    );
}

function UserDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['admin-user', id],
        queryFn: () => api.admin.userDetail(id),
        enabled: !!id,
    });

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
            <Card className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {data ? data.user.username : 'User details'}
                            {data?.user.isAdmin && <Badge variant="warning" className="px-1 py-0 h-4 text-[9px]">ADMIN</Badge>}
                            {data?.user.isBanned && <Badge variant="destructive" className="px-1 py-0 h-4 text-[9px]">BANNED</Badge>}
                        </CardTitle>
                        {data && <p className="text-sm text-muted-foreground mt-1">{data.user.email}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                    {isLoading && (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    )}

                    {error && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            Failed to load user details.
                        </div>
                    )}

                    {data && (
                        <>
                            {/* Key figures */}
                            <div className="grid grid-cols-2 gap-2">
                                <StatBox label="Balance" value={formatUSDT(data.balance)} accent="text-cyan-400" />
                                <StatBox label="Profit" value={formatUSDT(data.profit)} accent="text-emerald-400" />
                                <StatBox label="Total Deposit" value={formatUSDT(data.totalDeposit)} accent="text-amber-400" />
                                <StatBox label="Team Volume" value={formatUSDT(data.teamVolume)} accent="text-violet-400" />
                                <StatBox label="Referral Earnings" value={formatUSDT(data.referralEarnings)} />
                                <StatBox label="Direct Referrals" value={String(data.user._count.referrals)} />
                            </div>

                            {/* Identity */}
                            <div className="space-y-2 text-sm">
                                <DetailRow label="Referral code" value={data.user.referralCode || '—'} mono />
                                <DetailRow label="Referred by" value={data.user.referrer?.username || '—'} />
                                <DetailRow
                                    label="Deposit address"
                                    value={data.user.bscDepositAddress ? shortAddress(data.user.bscDepositAddress) : '—'}
                                    mono
                                />
                                <DetailRow
                                    label="Withdraw address"
                                    value={data.user.bscWithdrawAddress ? shortAddress(data.user.bscWithdrawAddress) : '—'}
                                    mono
                                />
                                <DetailRow label="Joined" value={formatDate(data.user.createdAt)} />
                            </div>

                            {/* Counts */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg border border-border/60 p-2">
                                    <p className="text-lg font-bold">{data.user._count.cycles}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cycles</p>
                                </div>
                                <div className="rounded-lg border border-border/60 p-2">
                                    <p className="text-lg font-bold">{data.user._count.deposits}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Deposits</p>
                                </div>
                                <div className="rounded-lg border border-border/60 p-2">
                                    <p className="text-lg font-bold">{data.user._count.withdrawals}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Withdrawals</p>
                                </div>
                            </div>

                            {/* Referrals by level */}
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                                    Referrals by level
                                </p>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                                    {data.referralCountsByLevel.map((count, i) => (
                                        <div key={i} className="rounded-lg border border-border/60 bg-muted/20 p-2">
                                            <p className="text-base font-bold">{count}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">L{i + 1}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Recent activity */}
                            <ActivityList
                                title="Recent deposits"
                                empty="No deposits"
                                items={data.recentDeposits.map((d) => ({
                                    id: d.id,
                                    left: formatUSDT(d.amount),
                                    mid: d.status,
                                    right: formatDate(d.createdAt),
                                }))}
                            />
                            <ActivityList
                                title="Recent withdrawals"
                                empty="No withdrawals"
                                items={data.recentWithdrawals.map((w) => ({
                                    id: w.id,
                                    left: formatUSDT(w.amount),
                                    mid: w.status,
                                    right: formatDate(w.createdAt),
                                }))}
                            />
                            <ActivityList
                                title="Recent cycles"
                                empty="No cycles"
                                items={data.recentCycles.map((c) => ({
                                    id: c.id,
                                    left: formatUSDT(c.principal),
                                    mid: `${c.tier} · ${c.status}`,
                                    right: formatDate(c.startedAt),
                                }))}
                            />
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className={mono ? 'font-mono text-xs' : ''}>{value}</span>
        </div>
    );
}

function ActivityList({
    title,
    empty,
    items,
}: {
    title: string;
    empty: string;
    items: { id: string; left: string; mid: string; right: string }[];
}) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{title}</p>
            {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">{empty}</p>
            ) : (
                <div className="space-y-1">
                    {items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between gap-2 rounded-md border border-border/40 px-2.5 py-1.5 text-xs">
                            <span className="font-medium">{it.left}</span>
                            <span className="text-muted-foreground">{it.mid}</span>
                            <span className="text-muted-foreground">{it.right}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
