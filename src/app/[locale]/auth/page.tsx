"use client";
import React, { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Utensils, Github, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AuthSkeleton } from '@/components/auth/AuthSkeleton';

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
    const { login, signup, isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasCheckedInitialAuth, setHasCheckedInitialAuth] = useState(false);
    const [isInitialAuth, setIsInitialAuth] = useState(false);

    const callbackUrl = searchParams.get('callbackUrl') || '/profile';
    const errorParam = searchParams.get('error');
    const t = useTranslations('auth');

    useEffect(() => {
        if (!authLoading && !hasCheckedInitialAuth) {
            if (isAuthenticated) {
                setIsInitialAuth(true);
            }
            setHasCheckedInitialAuth(true);
        }
    }, [authLoading, isAuthenticated, hasCheckedInitialAuth]);

    useEffect(() => {
        if (hasCheckedInitialAuth && isInitialAuth && isAuthenticated && !authLoading) {
            toast.info(t('alreadyLoggedIn') || 'Already logged in');
            router.replace(callbackUrl);
        }
    }, [hasCheckedInitialAuth, isInitialAuth, isAuthenticated, authLoading, router, callbackUrl, t]);

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
            toast.success(t('loginSuccess'));
            setIsInitialAuth(false);
            
            // Set authenticating to false slightly before redirect to show clean state
            setIsLoading(false);
            
            // Force a slight delay to ensure AuthContext state is propagated
            setTimeout(() => {
                router.push(callbackUrl);
            }, 100);
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
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            await signup(regName, regEmail, regPassword);
            toast.success(t('signupSuccess'));
            setIsInitialAuth(false);

            // Set authenticating to false slightly before redirect to show clean state
            setIsLoading(false);

            // Force a slight delay to ensure AuthContext state is propagated
            setTimeout(() => {
                router.push(callbackUrl);
            }, 100);
        } catch (err: unknown) {
            const error = err as Error;
            setError(error.message || t('signupFailed'));
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = '/api/auth/google/login';
    };

    // Only show skeleton during the INITIAL session check OR if we landed already logged in
    if (authLoading || (isAuthenticated && isInitialAuth)) {
        return <AuthSkeleton />;
    }

    return (
        <div className="min-h-[85vh] flex items-center justify-center p-4 pt-28 pb-12">
            <Card className="w-full max-w-[440px] rounded-[2rem] shadow-2xl border-none overflow-hidden bg-background">
                <div className="bg-accent-gold/90 p-6 text-white flex flex-col items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                        <Utensils className="w-6 h-6" />
                    </div>
                    <div className="text-center space-y-1">
                        <CardTitle className="text-2xl font-bold font-display">{t('title')}</CardTitle>
                        <CardDescription className="text-white/80 text-xs">{t('subtitle')}</CardDescription>
                    </div>
                </div>

                <CardContent className="p-6 md:p-8">
                    <Tabs defaultValue="login" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/50 p-1 rounded-full">
                            <TabsTrigger value="login" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 text-xs font-bold uppercase tracking-wider data-[state=active]:text-accent-gold">{t('signIn')}</TabsTrigger>
                            <TabsTrigger value="register" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm py-2 text-xs font-bold uppercase tracking-wider data-[state=active]:text-accent-gold">{t('signUp')}</TabsTrigger>
                        </TabsList>

                        {error && (
                            <Alert variant="destructive" className="mb-6 rounded-xl bg-red-50 border-red-100">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription className="text-xs font-medium text-red-600">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        )}

                        <TabsContent value="login" className="space-y-4">
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="email" className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">{t('email')}</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@example.com"
                                        className="rounded-xl h-12 focus-visible:ring-accent-gold border-muted"
                                        value={loginEmail}
                                        onChange={(e) => setLoginEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between">
                                        <Label htmlFor="password" className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">{t('password')}</Label>
                                        <button type="button" className="text-[10px] text-accent-gold font-bold hover:underline uppercase tracking-wider">{t('forgot')}</button>
                                    </div>
                                    <Input
                                        id="password"
                                        type="password"
                                        className="rounded-xl h-12 focus-visible:ring-accent-gold border-muted"
                                        value={loginPassword}
                                        onChange={(e) => setLoginPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full h-12 rounded-full text-sm font-bold uppercase tracking-widest shadow-lg bg-accent-gold hover:bg-accent-gold/90 text-primary-foreground mt-2" disabled={isLoading}>
                                    {isLoading ? t('authenticating') : t('signIn')}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="register" className="space-y-4">
                            <form onSubmit={handleSignup} className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="full-name" className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">{t('fullName')}</Label>
                                    <Input
                                        id="full-name"
                                        placeholder="John Doe"
                                        className="rounded-xl h-12 focus-visible:ring-accent-gold border-muted"
                                        value={regName}
                                        onChange={(e) => setRegName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="reg-email" className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">{t('email')}</Label>
                                    <Input
                                        id="reg-email"
                                        type="email"
                                        placeholder="name@example.com"
                                        className="rounded-xl h-12 focus-visible:ring-accent-gold border-muted"
                                        value={regEmail}
                                        onChange={(e) => setRegEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="reg-password"  className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">{t('password')}</Label>
                                        <Input
                                            id="reg-password"
                                            type="password"
                                            className="rounded-xl h-12 focus-visible:ring-accent-gold border-muted text-xs"
                                            value={regPassword}
                                            onChange={(e) => setRegPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="confirm-password" className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">{t('confirm')}</Label>
                                        <Input
                                            id="confirm-password"
                                            type="password"
                                            className="rounded-xl h-12 focus-visible:ring-accent-gold border-muted text-xs"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 pt-1">
                                    <Checkbox id="terms" className="mt-0.5 border-accent-gold data-[state=checked]:bg-accent-gold" />
                                    <div className="grid gap-1.5 leading-none">
                                        <label htmlFor="terms" className="text-[10px] font-medium text-muted-foreground leading-snug cursor-pointer">
                                            {t('terms')}
                                        </label>
                                    </div>
                                </div>

                                <Button type="submit" className="w-full h-12 rounded-full text-sm font-bold uppercase tracking-widest shadow-lg bg-accent-gold hover:bg-accent-gold/90 text-primary-foreground mt-2" disabled={isLoading}>
                                    {isLoading ? t('creating') : t('joinNow')}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-muted"></span>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-bold">
                            <span className="bg-background px-4 text-muted-foreground/50">{t('secureGateway')}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <Button
                            variant="outline"
                            className="rounded-xl h-12 gap-3 hover:bg-muted/50 border-muted font-bold text-xs uppercase tracking-widest"
                            onClick={handleGoogleLogin}
                            type="button"
                        >
                            <GoogleIcon className="w-4 h-4" />
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
        <Suspense fallback={<AuthSkeleton />}>
            <AuthPageContent />
        </Suspense>
    );
}
