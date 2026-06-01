import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, shortAddress } from '@/lib/utils';
import { Loader2, Users } from 'lucide-react';

export default function AdminUsers() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['admin-users'],
        queryFn: api.admin.users,
    });

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
                            { label: 'With Deposit Addr', value: data.users.filter((u) => u.bscDepositAddress).length },
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
                                        <TableHead>Role</TableHead>
                                        <TableHead className="hidden md:table-cell">Deposit Address</TableHead>
                                        <TableHead>Cycles</TableHead>
                                        <TableHead className="hidden lg:table-cell">Deposits</TableHead>
                                        <TableHead className="hidden lg:table-cell">Withdrawals</TableHead>
                                        <TableHead className="hidden xl:table-cell">Joined</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.users.map((u) => (
                                        <TableRow key={u.id}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-sm">{u.username}</p>
                                                    <p className="text-xs text-muted-foreground">{u.email}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {u.isAdmin
                                                    ? <Badge variant="warning">Admin</Badge>
                                                    : <Badge variant="outline">User</Badge>
                                                }
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">
                                                {u.bscDepositAddress ? shortAddress(u.bscDepositAddress) : '—'}
                                            </TableCell>
                                            <TableCell>{u._count.cycles}</TableCell>
                                            <TableCell className="hidden lg:table-cell">{u._count.deposits}</TableCell>
                                            <TableCell className="hidden lg:table-cell">{u._count.withdrawals}</TableCell>
                                            <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                                                {formatDate(u.createdAt)}
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
