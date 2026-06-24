import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            await api.auth.forgotPassword({ email });
        } catch {
            // Endpoint always succeeds; ignore errors to avoid leaking account existence.
        } finally {
            setLoading(false);
            setSent(true);
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
                        <CardTitle className="text-xl">Forgot Password</CardTitle>
                        <CardDescription>We'll email you a link to reset it</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {sent ? (
                            <div className="space-y-4">
                                <div className="rounded-lg border border-border bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">
                                    If an account exists for that email, we've sent a password reset link. Please check your inbox (and spam folder). The link expires in 30 minutes.
                                </div>
                                <Link to="/login">
                                    <Button variant="brand" className="w-full">Back to sign in</Button>
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>

                                <Button type="submit" variant="brand" className="w-full" disabled={loading}>
                                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {loading ? 'Sending…' : 'Send reset link'}
                                </Button>
                            </form>
                        )}

                        {!sent && (
                            <p className="mt-5 text-center text-sm text-muted-foreground">
                                Remembered it?{' '}
                                <Link to="/login" className="font-medium text-primary hover:underline">
                                    Sign in
                                </Link>
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
