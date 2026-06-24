import { useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        if (password !== confirm) {
            setError('Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            await api.auth.resetPassword({ token, password });
            toast({ title: 'Password updated. Please sign in.', variant: 'success' });
            navigate('/login', { replace: true });
        } catch (err: any) {
            setError(err.message ?? 'Could not reset password');
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
                        <CardTitle className="text-xl">Set a new password</CardTitle>
                        <CardDescription>Choose a strong password for your account</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!token ? (
                            <div className="space-y-4">
                                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    This reset link is missing its token. Please request a new one.
                                </div>
                                <Link to="/forgot-password">
                                    <Button variant="brand" className="w-full">Request a new link</Button>
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="password">New password</Label>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            type={showPw ? 'text' : 'password'}
                                            placeholder="Min. 8 characters"
                                            autoComplete="new-password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
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
                                    <Label htmlFor="confirm">Confirm password</Label>
                                    <Input
                                        id="confirm"
                                        type={showPw ? 'text' : 'password'}
                                        placeholder="Re-enter your password"
                                        autoComplete="new-password"
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        required
                                        minLength={8}
                                    />
                                </div>

                                <Button type="submit" variant="brand" className="w-full" disabled={loading}>
                                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {loading ? 'Updating…' : 'Update password'}
                                </Button>
                            </form>
                        )}

                        <p className="mt-5 text-center text-sm text-muted-foreground">
                            Back to{' '}
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
