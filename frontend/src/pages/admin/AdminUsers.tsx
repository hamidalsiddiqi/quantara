import { useQuery } from '@tanstack/react-query';
import { api, AdminUser } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatDate, shortAddress, formatUSDT } from '@/lib/utils';
import { Loader2, Users, ShieldAlert, ShieldCheck, Coins, TrendingUp, ArrowDownToLine } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function AdminUsers() {
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
                                        <TableHead className="hidden md:table-cell">Bonus</TableHead>
                                        <TableHead>Cycles</TableHead>
                                        <TableHead className="hidden lg:table-cell">Deposits</TableHead>
                                        <TableHead className="hidden xl:table-cell">Joined</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.users.map((u) => (
                                        <TableRow key={u.id} className={u.isBanned ? 'opacity-50' : ''}>
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
                                                Bal: {formatUSDT(u.adminBalance || '0')} <br />
                                                Prof: {formatUSDT(u.adminProfits || '0')}
                                            </TableCell>
                                            <TableCell>{u._count.cycles}</TableCell>
                                            <TableCell className="hidden lg:table-cell">{u._count.deposits}</TableCell>
                                            <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                                                {formatDate(u.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-right space-x-1">
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
        </div>
    );
}
