"use client";
import React, { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Utensils, Github, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslations } from 'next-intl';

const GoogleIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24">
        <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
        />
        <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
        />
        <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
        />
        <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
        />
    </svg>
);

function AuthPageContent() {
    const { login, signup } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const callbackUrl = searchParams.get('callbackUrl') || '/profile';
    const errorParam = searchParams.get('error');
    const t = useTranslations('auth');

    useEffect(() => {
        if (errorParam) {
            setError(errorParam);
        }
    }, [errorParam]);

    // Login states
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Register states
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await login(loginEmail, loginPassword);
            router.push(callbackUrl);
        } catch (err: unknown) {
            const error = err as Error;
            setError(error.message || t('loginFailed'));
            setIsLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (regPassword !== confirmPassword) {
            setError(t('passwordMismatch'));
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            await signup(regName, regEmail, regPassword);
            router.push(callbackUrl);
        } catch (err: unknown) {
            const error = err as Error;
            setError(error.message || t('signupFailed'));
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = '/api/auth/google/login';
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4 py-20">
            <Card className="w-full max-w-md rounded-[2.5rem] shadow-2xl border-none overflow-hidden">
                <div className="bg-accent-gold p-10 text-white flex flex-col items-center gap-6">
                    <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md">
                        <Utensils className="w-8 h-8" />
                    </div>
                    <div className="text-center space-y-2">
                        <CardTitle className="text-3xl font-bold font-headline">{t('title')}</CardTitle>
                        <CardDescription className="text-white/80">{t('subtitle')}</CardDescription>
                    </div>
                </div>

                <CardContent className="p-10">
                    <Tabs defaultValue="login" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-10 bg-muted/50 p-1.5 rounded-full">
                            <TabsTrigger value="login" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-lg py-3 data-[state=active]:text-accent-gold">{t('signIn')}</TabsTrigger>
                            <TabsTrigger value="register" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-lg py-3 data-[state=active]:text-accent-gold">{t('signUp')}</TabsTrigger>
                        </TabsList>

                        {error && (
                            <Alert variant="destructive" className="mb-6 rounded-2xl bg-red-50 border-red-100">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription className="text-xs font-medium text-red-600">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        )}

                        <TabsContent value="login" className="space-y-6">
                            <form onSubmit={handleLogin} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="email">{t('email')}</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        className="rounded-2xl h-14 focus-visible:ring-accent-gold"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label htmlFor="password">{t('password')}</Label>
                                        <button type="button" className="text-xs text-accent-gold font-bold hover:underline">{t('forgot')}</button>
                                    </div>
                                    <Input
                                        id="password"
                                        type="password"
                                        className="rounded-2xl h-14 focus-visible:ring-accent-gold"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full h-14 rounded-full text-lg shadow-xl bg-accent-gold hover:bg-accent-gold/90 text-primary-foreground" disabled={isLoading}>
                                    {isLoading ? t('authenticating') : t('signIn')}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="register" className="space-y-6">
                            <form onSubmit={handleSignup} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="full-name">{t('fullName')}</Label>
                                    <Input
                                        id="full-name"
                                        placeholder="John Doe"
                                        className="rounded-2xl h-14 focus-visible:ring-accent-gold"
                                        value={regName}
                                        onChange={(e) => setRegName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="reg-email">{t('email')}</Label>
                                    <Input
                                        id="reg-email"
                                        type="email"
                                        placeholder="name@example.com"
                                        className="rounded-2xl h-14 focus-visible:ring-accent-gold"
                                        value={regEmail}
                                        onChange={(e) => setRegEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-password">{t('password')}</Label>
                                        <Input
                                            id="reg-password"
                                            type="password"
                                            className="rounded-2xl h-14 focus-visible:ring-accent-gold"
                                            value={regPassword}
                                            onChange={(e) => setRegPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirm-password">{t('confirm')}</Label>
                                        <Input
                                            id="confirm-password"
                                            type="password"
                                            className="rounded-2xl h-14 focus-visible:ring-accent-gold"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 pt-2">
                                    <Checkbox id="terms" className="mt-1 border-accent-gold data-[state=checked]:bg-accent-gold" />
                                    <div className="grid gap-1.5 leading-none">
                                        <label htmlFor="terms" className="text-xs font-medium text-muted-foreground leading-relaxed cursor-pointer">
                                            {t('terms')}
                                        </label>
                                    </div>
                                </div>

                                <Button type="submit" className="w-full h-14 rounded-full text-lg shadow-xl bg-accent-gold hover:bg-accent-gold/90 text-primary-foreground" disabled={isLoading}>
                                    {isLoading ? t('creating') : t('joinNow')}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>

                    <div className="relative my-10">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t"></span>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-4 text-muted-foreground font-bold">{t('secureGateway')}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button
                            variant="outline"
                            className="rounded-2xl h-14 gap-2 hover:bg-secondary/30"
                            onClick={handleGoogleLogin}
                            type="button"
                        >
                            <GoogleIcon className="w-5 h-5" />
                            {t('google')}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function AuthPage() {
    return (
        <Suspense fallback={
            <div className="min-h-[80vh] flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-accent-gold" />
            </div>
        }>
            <AuthPageContent />
        </Suspense>
    );
}
