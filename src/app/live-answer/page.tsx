'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function EnterCodePage() {
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const handleJoinSession = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code || code.length < 6) {
            toast({ title: "Invalid Code", description: "Please enter a valid session code.", variant: "destructive" });
            return;
        }
        setIsLoading(true);

        const sessionRef = doc(db, 'live-sessions', code);
        try {
            const sessionSnap = await getDoc(sessionRef);
            if (sessionSnap.exists()) {
                router.push(`/live-answer/${code}`);
            } else {
                toast({ title: "Not Found", description: "This session code does not exist.", variant: "destructive" });
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Error joining session:", error);
            toast({ title: "Error", description: "Could not join the session. Please try again.", variant: "destructive" });
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8 flex items-center justify-center min-h-[calc(100vh-8rem)]">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Join Live Session</CardTitle>
                    <CardDescription>Enter the code from your teacher to begin.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleJoinSession} className="space-y-4">
                        <Input
                            placeholder="e.g., aB1cDe"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="text-center text-lg font-mono tracking-widest"
                            maxLength={6}
                        />
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Joining...
                                </>
                            ) : (
                                "Join Session"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
