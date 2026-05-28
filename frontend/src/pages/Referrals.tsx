import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Copy, Check, Share2, Loader2, TrendingUp, Award } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { formatUSDT, formatDate } from '@/lib/utils';

export default function Referrals() {
    const [copied, setCopied] = useState(false);

    const overviewQuery = useQuery({
        queryKey: ['referrals', 'overview'],
        queryFn: () => api.referrals.overview(),
    });
    const statsQuery = useQuery({
        queryKey: ['referrals', 'stats'],
        queryFn: () => api.referrals.stats(),
    });
    const earningsQuery = useQuery({
        queryKey: ['referrals', 'earnings'],
        queryFn: () => api.referrals.earnings(50),
    });
    const downlineQuery = useQuery({
        queryKey: ['referrals', 'downline'],
        queryFn: () => api.referrals.downline(),
    });

    const referralCode = overviewQuery.data?.referralCode ?? '';
    const referralLink =
        typeof window !== 'undefined' && referralCode
            ? `${window.location.origin}/register?ref=${referralCode}`
            : '';

    async function handleCopy(text: string, label: string) {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast({ title: `${label} copied`, variant: 'success' });
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast({ title: 'Copy failed', variant: 'destructive' });
        }
    }

    async function handleShare() {
        if (!referralLink) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join Quantara',
                    text: 'Start earning daily USDT returns on Quantara — use my referral link:',
                    url: referralLink,
                });
            } catch {
                /* user cancelled */
            }
        } else {
            handleCopy(referralLink, 'Link');
        }
    }

    if (overviewQuery.isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const overview = overviewQuery.data;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Users className="h-6 w-6 text-amber-400" />
                    Referrals
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Invite friends and earn commission on every deposit they make — up to 6 levels deep.
                </p>
            </div>

            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="p-5">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                            Total commission earned
                        </p>
                        <p className="text-xl font-bold text-gold-gradient">
                            {formatUSDT(overview?.referralEarnings ?? '0')}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-5">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                            Team volume
                        </p>
                        <p className="text-xl font-bold">{formatUSDT(overview?.teamVolume ?? '0')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-5">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                            Direct referrals
                        </p>
                        <p className="text-xl font-bold">{overview?.directReferralCount ?? 0}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Referral code + link */}
            <Card className="border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-amber-400" />
                        Your referral code
                    </CardTitle>
                    <CardDescription>Share your code or link. Codes are case-insensitive.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Code
                        </label>
                        <div className="flex gap-2">
                            <Input value={referralCode} readOnly className="font-mono text-lg tracking-widest" />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleCopy(referralCode, 'Code')}
                                title="Copy code"
                            >
                                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Invite link
                        </label>
                        <div className="flex gap-2">
                            <Input value={referralLink} readOnly className="font-mono text-xs" />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleCopy(referralLink, 'Link')}
                                title="Copy link"
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="gold" size="icon" onClick={handleShare} title="Share">
                                <Share2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Payout schedule */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-amber-400" />
                        Commission schedule
                    </CardTitle>
                    <CardDescription>
                        You earn a percentage of the principal every time someone in your downline opens a cycle.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {(statsQuery.data?.levels ?? overview?.levels?.map((l) => ({ ...l, memberCount: 0, payoutCount: 0, earnings: '0' })) ?? []).map(
                            (lvl) => (
                                <div
                                    key={lvl.level}
                                    className="rounded-lg border border-border bg-secondary/30 p-4 flex flex-col gap-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <Badge variant="gold" className="text-xs">
                                            Level {lvl.level}
                                        </Badge>
                                        <span className="text-lg font-bold text-amber-400">{lvl.percent}%</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-0.5">
                                        <div className="flex justify-between">
                                            <span>Members</span>
                                            <span className="font-medium text-foreground">
                                                {(lvl as any).memberCount ?? 0}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Earned</span>
                                            <span className="font-medium text-foreground">
                                                {formatUSDT((lvl as any).earnings ?? '0')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ),
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* History tabs */}
            <Tabs defaultValue="earnings">
                <TabsList>
                    <TabsTrigger value="earnings">Recent commissions</TabsTrigger>
                    <TabsTrigger value="downline">Direct downline</TabsTrigger>
                </TabsList>

                <TabsContent value="earnings">
                    <Card>
                        <CardContent className="p-0">
                            {earningsQuery.isLoading ? (
                                <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
                            ) : (earningsQuery.data?.items.length ?? 0) === 0 ? (
                                <div className="p-6 text-center text-sm text-muted-foreground">
                                    No referral commissions yet. Share your code to start earning.
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {earningsQuery.data!.items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-4 hover:bg-accent/30"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="gold" className="text-[10px]">
                                                        L{item.level}
                                                    </Badge>
                                                    <span className="text-sm font-medium">
                                                        {item.sourceUsername}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {formatDate(item.createdAt)} · {item.bps / 100}%
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-amber-400">
                                                    +{formatUSDT(item.amount)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="downline">
                    <Card>
                        <CardContent className="p-0">
                            {downlineQuery.isLoading ? (
                                <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
                            ) : (downlineQuery.data?.items.length ?? 0) === 0 ? (
                                <div className="p-6 text-center text-sm text-muted-foreground">
                                    No direct referrals yet.
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {downlineQuery.data!.items.map((u) => (
                                        <div
                                            key={u.id}
                                            className="flex items-center justify-between p-4 hover:bg-accent/30"
                                        >
                                            <div>
                                                <p className="text-sm font-medium">{u.username}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Joined {formatDate(u.createdAt)}
                                                </p>
                                            </div>
                                            <div className="text-right text-xs text-muted-foreground">
                                                <div>{u._count.cycles} cycles</div>
                                                <div>{u._count.deposits} deposits</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
