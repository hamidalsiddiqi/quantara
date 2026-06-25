import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { user, token } = await api.auth.login({ identifier, password });
            login(token, user);
            toast({ title: `Welcome back, ${user.username}!`, variant: 'success' });
            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            setError(err.message ?? 'Login failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-blue-600/5 blur-3xl" />
                <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl" />
            </div>

            <div className="w-full max-w-md relative">
                {/* Logo */}
                <div className="flex items-center justify-center mb-8">
                    <img src="/logo.png" alt="Quantalix" className="h-20 w-auto" />
                </div>

                <Card className="glass border-brand shadow-2xl">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xl">Sign In</CardTitle>
                        <CardDescription>Access your investment dashboard</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="identifier">Email or username</Label>
                                <Input
                                    id="identifier"
                                    type="text"
                                    placeholder="you@example.com or username"
                                    autoComplete="username"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPw ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
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

                            <Button type="submit" variant="brand" className="w-full" disabled={loading}>
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {loading ? 'Signing in…' : 'Sign In'}
                            </Button>
                        </form>

                        <p className="mt-5 text-center text-sm text-muted-foreground">
                            Don&apos;t have an account?{' '}
                            <Link to="/register" className="font-medium text-primary hover:underline">
                                Create one
                            </Link>
                        </p>
                    </CardContent>
                </Card>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                    BSC Network · USDT BEP-20 · Daily ROI
                </p>
            </div>
        </div>
    );
}
