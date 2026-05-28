import { useEffect, useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TrendingUp, Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

export default function Register() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [form, setForm] = useState({ email: '', username: '', password: '', referralCode: '' });
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    // Prefill referral code from ?ref= query param or persisted storage.
    useEffect(() => {
        const fromQuery = searchParams.get('ref') ?? searchParams.get('referral');
        const fromStorage = localStorage.getItem('qnt_ref') ?? '';
        const code = (fromQuery ?? fromStorage).toUpperCase();
        if (code) {
            setForm((f) => ({ ...f, referralCode: code }));
            try { localStorage.setItem('qnt_ref', code); } catch {}
        }
    }, [searchParams]);

    function setField(field: string, value: string) {
        setForm((f) => ({ ...f, [field]: value }));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setErrors([]);
        setLoading(true);
        try {
            const payload: { email: string; username: string; password: string; referralCode?: string } = {
                email: form.email,
                username: form.username,
                password: form.password,
            };
            const code = form.referralCode.trim().toUpperCase();
            if (code) payload.referralCode = code;
            const { user, token } = await api.auth.register(payload);
            login(token, user);
            try { localStorage.removeItem('qnt_ref'); } catch {}
            toast({ title: `Welcome to Quantara, ${user.username}!`, variant: 'success' });
            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            setErrors([err.message ?? 'Registration failed']);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-3xl" />
                <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl" />
            </div>

            <div className="w-full max-w-md relative">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_30px_hsl(42_96%_52%/0.4)]">
                        <TrendingUp className="h-6 w-6 text-black" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gold-gradient">Quantara</h1>
                        <p className="text-xs text-muted-foreground">USDT Investment Platform</p>
                    </div>
                </div>

                <Card className="glass border-gold shadow-2xl">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl">Create Account</CardTitle>
                        <CardDescription>Start earning daily USDT returns</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {errors.length > 0 && (
                                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive space-y-1">
                                    {errors.map((e, i) => <p key={i}>{e}</p>)}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    value={form.email}
                                    onChange={(e) => setField('email', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="satoshi123"
                                    autoComplete="username"
                                    value={form.username}
                                    onChange={(e) => setField('username', e.target.value)}
                                    required
                                    minLength={3}
                                    maxLength={32}
                                    pattern="[a-zA-Z0-9_]+"
                                />
                                <p className="text-xs text-muted-foreground">Letters, numbers, underscores only</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPw ? 'text' : 'password'}
                                        placeholder="Min. 8 characters"
                                        autoComplete="new-password"
                                        value={form.password}
                                        onChange={(e) => setField('password', e.target.value)}
                                        required
                                        minLength={8}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        onClick={() => setShowPw(!showPw)}
                                    >
                                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="referralCode">
                                    Referral code <span className="text-muted-foreground font-normal">(optional)</span>
                                </Label>
                                <Input
                                    id="referralCode"
                                    type="text"
                                    placeholder="e.g. ABCD1234"
                                    autoComplete="off"
                                    value={form.referralCode}
                                    onChange={(e) => setField('referralCode', e.target.value.toUpperCase())}
                                    maxLength={32}
                                    pattern="[A-Za-z0-9]+"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Got invited? Enter your sponsor's code to credit them.
                                </p>
                            </div>

                            {/* Tier overview teaser */}
                            <div className="rounded-lg bg-secondary/40 border border-border p-3 space-y-1.5">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Investment Tiers</p>
                                {[
                                    { name: 'Starter', range: '$20 – $999', roi: '1.50%/day', days: '30d' },
                                    { name: 'Pro', range: '$1,000 – $4,999', roi: '1.80%/day', days: '45d' },
                                    { name: 'Elite', range: '$5,000+', roi: '2.00%/day', days: '60d' },
                                ].map((t) => (
                                    <div key={t.name} className="flex items-center justify-between text-xs">
                                        <span className="font-medium">{t.name}</span>
                                        <span className="text-muted-foreground">{t.range}</span>
                                        <span className="text-amber-400 font-semibold">{t.roi}</span>
                                    </div>
                                ))}
                            </div>

                            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {loading ? 'Creating account…' : 'Create Account'}
                            </Button>
                        </form>

                        <p className="mt-5 text-center text-sm text-muted-foreground">
                            Already have an account?{' '}
                            <Link to="/login" className="font-medium text-primary hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
