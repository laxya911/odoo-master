
"use client"

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Utensils, Github, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AuthPage() {
    const { login, signup } = useAuth();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            router.push('/profile');
        } catch (err: unknown) {
            const error = err as Error;
            setError(error.message || 'Login failed');
            setIsLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (regPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            await signup(regName, regEmail, regPassword);
            router.push('/profile');
        } catch (err: unknown) {
            const error = err as Error;
            setError(error.message || 'Signup failed');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4 py-20">
            <Card className="w-full max-w-md rounded-[2.5rem] shadow-2xl border-none overflow-hidden">
                <div className="bg-accent-gold p-10 text-white flex flex-col items-center gap-6">
                    <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md">
                        <Utensils className="w-8 h-8" />
                    </div>
                    <div className="text-center space-y-2">
                        <CardTitle className="text-3xl font-bold font-headline">Member Access</CardTitle>
                        <CardDescription className="text-white/80">Join the RAM Indian Restaurant family</CardDescription>
                    </div>
                </div>

                <CardContent className="p-10">
                    <Tabs defaultValue="login" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-10 bg-muted/50 p-1.5 rounded-full">
                            <TabsTrigger value="login" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-lg py-3 data-[state=active]:text-accent-gold">Sign In</TabsTrigger>
                            <TabsTrigger value="register" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-lg py-3 data-[state=active]:text-accent-gold">Sign Up</TabsTrigger>
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
                                    <Label htmlFor="email">Email Address</Label>
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
                                        <Label htmlFor="password">Password</Label>
                                        <button type="button" className="text-xs text-accent-gold font-bold hover:underline">Forgot?</button>
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
                                    {isLoading ? "Authenticating..." : "Sign In"}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="register" className="space-y-6">
                            <form onSubmit={handleSignup} className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="full-name">Full Name</Label>
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
                                    <Label htmlFor="reg-email">Email Address</Label>
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
                                        <Label htmlFor="reg-password">Password</Label>
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
                                        <Label htmlFor="confirm-password">Confirm</Label>
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
                                            I agree to the <Link href="/terms" className="text-accent-gold font-bold hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-accent-gold font-bold hover:underline">Data Protection Policy</Link>.
                                        </label>
                                    </div>
                                </div>

                                <Button type="submit" className="w-full h-14 rounded-full text-lg shadow-xl bg-accent-gold hover:bg-accent-gold/90 text-primary-foreground" disabled={isLoading}>
                                    {isLoading ? "Creating Account..." : "Join Now"}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>

                    <div className="relative my-10">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t"></span>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-4 text-muted-foreground font-bold">Secure Gateway</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Button variant="outline" className="rounded-2xl h-14 gap-2 hover:bg-secondary/30">
                            <Mail className="w-4 h-4" />
                            Google
                        </Button>
                        <Button variant="outline" className="rounded-2xl h-14 gap-2 hover:bg-secondary/30">
                            <Github className="w-4 h-4" />
                            Github
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
