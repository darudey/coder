
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Compiler } from '@/components/codeweave/compiler';
import { Header } from '@/components/codeweave/header';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { LoadingPage } from '@/components/loading-page';

interface LiveQuestion {
    question: string;
    initialCode: string;
}

export default function LiveAnswerPage() {
    const { toast } = useToast();
    const [liveQuestion, setLiveQuestion] = React.useState<LiveQuestion | null>(null);
    const [answerCode, setAnswerCode] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    React.useEffect(() => {
        const unsub = onSnapshot(doc(db, "live-qna", "question"), (doc) => {
            if (doc.exists()) {
                const data = doc.data() as LiveQuestion;
                setLiveQuestion(data);
                setAnswerCode(data.initialCode);
            } else {
                setLiveQuestion(null);
            }
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    const handleCodeChange = (newCode: string) => {
        setAnswerCode(newCode);
    }
    
    React.useEffect(() => {
        const submitAnswer = async () => {
             if (answerCode !== liveQuestion?.initialCode) {
                await setDoc(doc(db, 'live-qna', 'answer'), { code: answerCode });
             }
        };
        const handler = setTimeout(() => {
            submitAnswer();
        }, 500); // Debounce submission

        return () => clearTimeout(handler);
    }, [answerCode, liveQuestion]);


    if (isLoading) {
        return <LoadingPage />;
    }

    return (
        <>
            <Header variant="page">
                <div className="border rounded-md px-4 py-1.5 bg-muted min-w-0">
                    <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight truncate">Live Question</h1>
                </div>
            </Header>

            <div className="px-4 py-6">
                {liveQuestion ? (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold tracking-tight">Question from your Teacher</h2>
                        <p className="text-muted-foreground">{liveQuestion.question}</p>
                        
                        <div className="grid gap-2">
                            <p className="text-sm font-medium">Your Answer</p>
                            <div className="h-full min-h-[400px] border rounded-md">
                                <Compiler
                                    onCodeChange={handleCodeChange}
                                    initialCode={liveQuestion.initialCode}
                                    variant="minimal"
                                    hideHeader
                                    key={liveQuestion.initialCode}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-md">
                        <p>Waiting for the teacher to publish a live question...</p>
                    </div>
                )}
            </div>
        </>
    );
}

// Add onCodeChange to Compiler props
declare module '@/components/codeweave/compiler' {
    interface CompilerProps {
        onCodeChange?: (code: string) => void;
    }
}
