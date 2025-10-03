
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/codeweave/header';

const authSchema = z.object({
    email: z.string().email({ message: "Please enter a valid email address." }),
    password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type AuthFormValues = z.infer<typeof authSchema>;

export default function ProfilePage() {
    const { 
        user, 
        userRole, 
        loading, 
        signInWithGoogle, 
        signOut, 
        registerWithEmail, 
        signInWithEmail, 
        signInAnonymously 
    } = useAuth();

    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<AuthFormValues>({
        resolver: zodResolver(authSchema),
        defaultValues: { email: "", password: "" },
    });
    
    const registerForm = useForm<AuthFormValues>({
        resolver: zodResolver(authSchema),
        defaultValues: { email: "", password: "" },
    });

    const handleEmailSignIn = async (values: AuthFormValues) => {
        setIsSubmitting(true);
        await signInWithEmail(values.email, values.password);
        setIsSubmitting(false);
    }

    const handleEmailRegister = async (values: AuthFormValues) => {
        setIsSubmitting(true);
        await registerWithEmail(values.email, values.password);
        setIsSubmitting(false);
    }

    const handleAnonymousSignIn = async () => {
        setIsSubmitting(true);
        await signInAnonymously();
        setIsSubmitting(false);
    }

    if (loading) {
        return (
            <>
                <Header variant="page">
                  <div className="border rounded-md px-4 py-1.5 bg-muted">
                      <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight truncate">Profile</h1>
                  </div>
                </Header>
                <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
                    <Card className="w-full max-w-md">
                        <CardHeader className="items-center text-center">
                            <Skeleton className="w-24 h-24 rounded-full mb-4" />
                            <Skeleton className="h-8 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </CardHeader>
                        <CardContent className="flex justify-center">
                            <Skeleton className="h-10 w-28" />
                        </CardContent>
                    </Card>
                </div>
            </>
        );
    }

    if (!user) {
        return (
            <>
                <Header variant="page">
                    <div className="border rounded-md px-4 py-1.5 bg-muted">
                        <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight truncate">Sign In / Register</h1>
                    </div>
                </Header>
                <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
                    <Card className="w-full max-w-sm">
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl font-bold">Welcome!</CardTitle>
                            <CardDescription>
                                Sign in or create an account to continue.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="signin">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="signin">Sign In</TabsTrigger>
                                    <TabsTrigger value="register">Register</TabsTrigger>
                                </TabsList>
                                <TabsContent value="signin">
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(handleEmailSignIn)} className="space-y-4 pt-4">
                                            <FormField
                                                control={form.control}
                                                name="email"
                                                render={({ field }) => (
                                                    <FormItem>
                                                    <FormLabel>Email</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="you@example.com" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="password"
                                                render={({ field }) => (
                                                    <FormItem>
                                                    <FormLabel>Password</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" placeholder="••••••••" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Sign In
                                            </Button>
                                        </form>
                                    </Form>
                                </TabsContent>
                                <TabsContent value="register">
                                    <Form {...registerForm}>
                                        <form onSubmit={registerForm.handleSubmit(handleEmailRegister)} className="space-y-4 pt-4">
                                            <FormField
                                                control={registerForm.control}
                                                name="email"
                                                render={({ field }) => (
                                                    <FormItem>
                                                    <FormLabel>Email</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="you@example.com" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={registerForm.control}
                                                name="password"
                                                render={({ field }) => (
                                                    <FormItem>
                                                    <FormLabel>Password</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" placeholder="••••••••" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Create Account
                                            </Button>
                                        </form>
                                    </Form>
                                </TabsContent>
                            </Tabs>

                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Button variant="outline" onClick={signInWithGoogle} disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <svg className="mr-2 h-4 w-4" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Google</title><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.05 1.05-2.36 1.95-4.25 1.95-3.52 0-6.38-2.91-6.38-6.48s2.86-6.48 6.38-6.48c2.05 0 3.28.81 4.05 1.56l2.56-2.56c-1.6-1.56-3.6-2.56-6.61-2.56-5.49 0-9.91 4.42-9.91 9.91s4.42 9.91 9.91 9.91c5.19 0 9.4-3.52 9.4-9.61 0-.61-.05-.91-.11-1.31h-9.29z"/></svg>}
                                    Google
                                </Button>
                                <Button variant="outline" onClick={handleAnonymousSignIn} disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <User className="mr-2 h-4 w-4" />}
                                    Guest
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </>
        )
    }

    return (
        <>
            <Header variant="page">
              <div className="border rounded-md px-4 py-1.5 bg-muted">
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight truncate">Profile</h1>
              </div>
            </Header>
            <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
            <Card className="w-full max-w-md text-center">
                <CardHeader className="items-center">
                    <Avatar className="w-24 h-24 mb-4">
                        <AvatarImage src={user.isAnonymous ? undefined : user.photoURL || undefined} alt={user.isAnonymous ? 'Anonymous User' : user.displayName || 'User'} />
                        <AvatarFallback>
                            <User className="w-12 h-12" />
                        </AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-2xl font-bold">{user.isAnonymous ? 'Guest User' : user.displayName || user.email}</CardTitle>
                    {!user.isAnonymous && <CardDescription>{user.email}</CardDescription>}
                    {user.isAnonymous && <CardDescription>Your session is temporary.</CardDescription>}
                    {userRole && <Badge variant="secondary" className="mt-2">{userRole}</Badge>}
                </CardHeader>
                <CardContent>
                    <Button onClick={signOut} variant="outline">
                        <LogOut className="mr-2 h-4 w-4" /> Sign Out
                    </Button>
                </CardContent>
            </Card>
            </div>
        </>
    );
}
