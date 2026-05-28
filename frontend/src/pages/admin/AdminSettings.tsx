import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type TierDef } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Settings, Save } from 'lucide-react';

const TIER_NAMES = ['STARTER', 'PRO', 'ELITE'] as const;
type TierName = typeof TIER_NAMES[number];

const TIER_DEFAULTS: Record<TierName, TierDef> = {
    STARTER: { min: 20, max: 999, dailyRoiBps: 150, durationDays: 30 },
    PRO: { min: 1000, max: 4999, dailyRoiBps: 180, durationDays: 45 },
    ELITE: { min: 5000, max: 99999999, dailyRoiBps: 200, durationDays: 60 },
};

function TierEditor({
    name,
    value,
    onChange,
}: {
    name: TierName;
    value: TierDef;
    onChange: (val: TierDef) => void;
}) {
    function setField(field: keyof TierDef, raw: string) {
        const num = parseFloat(raw);
        if (!isNaN(num)) onChange({ ...value, [field]: num });
    }

    const tierColors: Record<TierName, string> = {
        STARTER: 'text-amber-400',
        PRO: 'text-blue-400',
        ELITE: 'text-emerald-400',
    };

    return (
        <div className="rounded-xl border border-border bg-secondary/20 p-5 space-y-4">
            <h3 className={`font-semibold text-lg ${tierColors[name]}`}>{name}</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label className="text-xs">Min Deposit (USDT)</Label>
                    <Input
                        type="number"
                        step="1"
                        min="0"
                        value={value.min}
                        onChange={(e) => setField('min', e.target.value)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs">Max Deposit (USDT)</Label>
                    <Input
                        type="number"
                        step="1"
                        min="1"
                        value={value.max === 99999999 ? '' : value.max}
                        placeholder="∞"
                        onChange={(e) => setField('max', e.target.value || '99999999')}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs">Daily ROI (basis points)</Label>
                    <div className="relative">
                        <Input
                            type="number"
                            step="1"
                            min="0"
                            max="10000"
                            value={value.dailyRoiBps}
                            onChange={(e) => setField('dailyRoiBps', e.target.value)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            = {(value.dailyRoiBps / 100).toFixed(2)}%
                        </span>
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs">Duration (days)</Label>
                    <Input
                        type="number"
                        step="1"
                        min="1"
                        max="3650"
                        value={value.durationDays}
                        onChange={(e) => setField('durationDays', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
}

export default function AdminSettings() {
    const qc = useQueryClient();
    const [tiers, setTiers] = useState({ ...TIER_DEFAULTS });

    const { data, isLoading } = useQuery({
        queryKey: ['admin-settings'],
        queryFn: api.admin.settings,
    });

    useEffect(() => {
        if (data?.tiers) {
            setTiers(data.tiers as any);
        }
    }, [data]);

    const saveMutation = useMutation({
        mutationFn: () => api.admin.saveTiers(tiers),
        onSuccess: () => {
            toast({ title: 'Tier settings saved!', variant: 'success' });
            qc.invalidateQueries({ queryKey: ['admin-settings'] });
        },
        onError: (e: any) => toast({ title: e.message ?? 'Save failed', variant: 'destructive' }),
    });

    function updateTier(name: TierName, val: TierDef) {
        setTiers((prev) => ({ ...prev, [name]: val }));
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
                    <Settings className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <p className="text-sm text-muted-foreground">Configure investment tier parameters</p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Investment Tiers</CardTitle>
                            <CardDescription>
                                Changes take effect for new investment cycles only. Existing cycles retain their original parameters.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {TIER_NAMES.map((name) => (
                                <TierEditor
                                    key={name}
                                    name={name}
                                    value={tiers[name]}
                                    onChange={(val) => updateTier(name, val)}
                                />
                            ))}

                            <div className="flex justify-end pt-2">
                                <Button
                                    variant="gold"
                                    onClick={() => saveMutation.mutate()}
                                    disabled={saveMutation.isPending}
                                    className="gap-2"
                                >
                                    {saveMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    {saveMutation.isPending ? 'Saving…' : 'Save Tiers'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Raw settings display */}
                    {data?.settings && data.settings.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Raw Settings Store</CardTitle>
                                <CardDescription>All key-value pairs from the settings table</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {data.settings.map((s) => (
                                        <div key={s.key} className="flex items-start gap-3 rounded-lg bg-secondary/30 p-3 text-sm">
                                            <code className="text-amber-400 flex-shrink-0 font-mono text-xs">{s.key}</code>
                                            <code className="text-muted-foreground font-mono text-xs break-all">{s.value}</code>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
