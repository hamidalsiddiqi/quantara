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
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3 tracking-tight">
                        <Users className="h-8 w-8 text-cyan-400" />
                        Referral Program
                    </h1>
                    <p className="text-base text-muted-foreground mt-1.5">
                        Build your team and earn commissions up to 6 levels deep.
                    </p>
                </div>
            </div>

            {/* Hero / Copy Link Section */}
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-900/40 via-background to-background shadow-2xl">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
                <CardContent className="p-8 sm:p-10 relative z-10 flex flex-col md:flex-row gap-8 items-center justify-between">
                    <div className="flex-1 space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-600/20 text-cyan-400 text-sm font-medium mb-2">
                            <Award className="h-4 w-4" /> Earn up to 12% total
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold">Invite Friends & Earn</h2>
                        <p className="text-muted-foreground text-sm sm:text-base max-w-md">
                            Share your link and earn a percentage of every deposit made by your network.
                        </p>
                    </div>

                    <div className="w-full md:w-auto bg-card/60 backdrop-blur-xl border border-border/50 p-6 rounded-2xl shadow-xl flex-1 max-w-md">
                        <div className="space-y-5">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                                    Your personal invite link
                                </label>
                                <div className="flex gap-2">
                                    <Input value={referralLink} readOnly className="font-mono text-sm bg-background/50 border-blue-600/30 focus-visible:ring-blue-600/50" />
                                    <Button
                                        variant="brand"
                                        size="icon"
                                        onClick={() => handleCopy(referralLink, 'Link')}
                                        title="Copy link"
                                        className="shrink-0"
                                    >
                                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={handleShare} title="Share" className="shrink-0 border-blue-600/30 hover:bg-blue-600/10 hover:text-cyan-400">
                                        <Share2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                                    Referral Code
                                </label>
                                <div className="flex gap-2">
                                    <Input value={referralCode} readOnly className="font-mono text-lg tracking-widest bg-background/50 border-border/50" />
                                    <Button
                                        variant="outline"
                                        onClick={() => handleCopy(referralCode, 'Code')}
                                        className="shrink-0 group hover:border-blue-600/50 hover:text-cyan-400 transition-colors"
                                    >
                                        <Copy className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" /> Copy
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card className="bg-card/40 backdrop-blur-md border border-border/60 hover:border-blue-600/30 transition-colors group">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 bg-blue-600/10 rounded-lg group-hover:bg-blue-600/20 transition-colors">
                                <Award className="h-5 w-5 text-cyan-400" />
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Total Earnings
                            </p>
                        </div>
                        <p className="text-3xl font-bold text-brand-gradient tracking-tight">
                            {formatUSDT(overview?.referralEarnings ?? '0')}
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-card/40 backdrop-blur-md border border-border/60 hover:border-border transition-colors group">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                <TrendingUp className="h-5 w-5 text-primary" />
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Team Volume
                            </p>
                        </div>
                        <p className="text-3xl font-bold tracking-tight">{formatUSDT(overview?.teamVolume ?? '0')}</p>
                    </CardContent>
                </Card>
                <Card className="bg-card/40 backdrop-blur-md border border-border/60 hover:border-border transition-colors group">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2.5 bg-secondary rounded-lg group-hover:bg-secondary/80 transition-colors">
                                <Users className="h-5 w-5 text-foreground" />
                            </div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Direct Referrals
                            </p>
                        </div>
                        <p className="text-3xl font-bold tracking-tight">{overview?.directReferralCount ?? 0}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Payout schedule */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-cyan-400" />
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
                                        <Badge variant="brand" className="text-xs">
                                            Level {lvl.level}
                                        </Badge>
                                        <span className="text-lg font-bold text-cyan-400">{lvl.percent}%</span>
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
                                                    <Badge variant="brand" className="text-[10px]">
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
                                                <p className="text-sm font-bold text-cyan-400">
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
