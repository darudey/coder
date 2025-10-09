'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PanelLeft, AlertTriangle } from 'lucide-react';
import { Compiler } from '@/components/codeweave/compiler';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { LoadingPage } from '@/components/loading-page';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface LiveQuestion {
    id: string;
    question: string;
    initialCode: string;
    solutionCode: string;
}

interface LiveSession {
    teacherId: string;
    studentId: string | null;
    isUsed: boolean;
    questions: LiveQuestion[];
    answers: { [key: string]: string };
}

interface LiveAnswerPageProps {
    params: {
        code: string;
    }
}

export default function LiveAnswerSessionPage({ params }: LiveAnswerPageProps) {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const sessionCode = params.code;

    const [session, setSession] = useState<LiveSession | null>(null);
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
    const [currentCode, setCurrentCode] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [accessDenied, setAccessDenied] = useState<string | null>(null);
    
    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            toast({ title: 'Please Sign In', description: 'You must be signed in to join a session.', variant: 'destructive' });
            setIsLoading(false);
            setAccessDenied("You must be signed in to join a session.");
            return;
        }
        if (!sessionCode) return;

        const sessionRef = doc(db, 'live-sessions', sessionCode);
        const unsub = onSnapshot(sessionRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as LiveSession;
                
                if (data.isUsed && data.studentId !== user.uid) {
                    setAccessDenied("This session code has already been used by another student.");
                    setIsLoading(false);
                    return;
                }
                
                if (!data.isUsed) {
                    await updateDoc(sessionRef, {
                        isUsed: true,
                        studentId: user.uid
                    });
                    // The snapshot will update with the new data, so we don't set state here.
                } else {
                    setSession(data);
                    if (!selectedQuestionId && data.questions.length > 0) {
                        const firstQuestionId = data.questions[0].id;
                        setSelectedQuestionId(firstQuestionId);
                        setCurrentCode(data.answers?.[firstQuestionId] || data.questions[0].initialCode);
                    }
                }
                
            } else {
                setAccessDenied("This session code is invalid or has expired.");
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Error listening to live session:", error);
            setIsLoading(false);
        });

        return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionCode, user, authLoading]);

    const handleCodeChange = (newCode: string) => {
        setCurrentCode(newCode);
    }
    
    useEffect(() => {
        if (!selectedQuestionId || isLoading || !session) return;
        
        const handler = setTimeout(() => {
            const path = `answers.${selectedQuestionId}`;
            updateDoc(doc(db, 'live-sessions', sessionCode), { 
                [path]: currentCode
            });
        }, 500); // Debounced save

        return () => clearTimeout(handler);
    }, [currentCode, selectedQuestionId, isLoading, session, sessionCode]);

    const handleSelectQuestion = (question: LiveQuestion) => {
        setSelectedQuestionId(question.id);
        setCurrentCode(session?.answers?.[question.id] || question.initialCode);
        setIsSidebarOpen(false);
    }
    
    if (isLoading || authLoading) {
        return <LoadingPage />;
    }

    if (accessDenied) {
        return (
            <div className="container mx-auto p-4 md:p-8 flex items-center justify-center min-h-[calc(100vh-8rem)]">
                <Card className="w-full max-w-md text-center">
                    <CardHeader className="items-center">
                        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
                        <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground">{accessDenied}</p>
                        <Button asChild>
                            <Link href="/live-answer">Try another code</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    const selectedQuestion = session?.questions.find(q => q.id === selectedQuestionId);

    const QuestionList = () => (
        <div className="p-2 flex flex-col h-full bg-muted/40">
            <h2 className="text-lg font-semibold tracking-tight mb-2 px-2">Questions</h2>
            <ScrollArea className="flex-grow">
                <div className="space-y-1">
                {(session?.questions || []).map((q, index) => (
                    <div key={q.id} className={cn(
                        "flex items-center justify-between p-2 rounded-md cursor-pointer group",
                        selectedQuestionId === q.id ? 'bg-primary/20' : 'hover:bg-accent'
                    )} onClick={() => handleSelectQuestion(q)}>
                        <p className="text-sm font-medium truncate flex-grow">
                           {index + 1}. {q.question}
                        </p>
                    </div>
                ))}
                </div>
            </ScrollArea>
        </div>
    );

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            <header className="flex items-center border-b p-2">
                <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                            <PanelLeft className="w-4 h-4" />
                            <span className="sr-only">Open Questions Panel</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-80">
                        <QuestionList />
                    </SheetContent>
                </Sheet>
                <h1 className="text-lg font-semibold ml-4">Live Q&A Session</h1>
            </header>
            <main className="flex-grow pt-6">
                {selectedQuestion ? (
                    <div className="space-y-4 h-full flex flex-col">
                        <h2 className="text-2xl font-bold tracking-tight px-4">{selectedQuestion.question}</h2>
                        
                        <div className="grid gap-2 flex-grow">
                            <p className="text-sm font-medium px-4">Your Answer</p>
                            <div className="h-full min-h-[400px]">
                                <Compiler
                                    onCodeChange={handleCodeChange}
                                    initialCode={currentCode}
                                    variant="minimal"
                                    hideHeader
                                    key={selectedQuestion.id}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-md h-full flex items-center justify-center mx-4">
                        <div className="max-w-md mx-auto">
                            <h2 className="text-xl font-semibold mb-2">Live Q&A Session</h2>
                            <p>
                                Welcome! Your teacher will publish questions here in real-time.
                                When a question appears, you can select it from the sidebar to start answering.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

declare module '@/components/codeweave/compiler' {
    interface CompilerProps {
        onCodeChange?: (code: string) => void;
    }
}
