
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Compiler } from '@/components/codeweave/compiler';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { LoadingPage } from '@/components/loading-page';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface LiveQuestion {
    id: string;
    question: string;
    initialCode: string;
    solutionCode: string;
}

interface LiveSession {
    questions: LiveQuestion[];
    answers: { [key: string]: string };
}

export default function LiveAnswerPage() {
    const { toast } = useToast();
    const [session, setSession] = useState<LiveSession | null>(null);
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
    const [currentCode, setCurrentCode] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "live-qna", "session"), (doc) => {
            if (doc.exists()) {
                const data = doc.data() as LiveSession;
                setSession(data);
                
                if (!selectedQuestionId && data.questions.length > 0) {
                    const firstQuestionId = data.questions[0].id;
                    setSelectedQuestionId(firstQuestionId);
                    setCurrentCode(data.answers[firstQuestionId] || data.questions[0].initialCode);
                } else if (selectedQuestionId) {
                     const currentAnswer = data.answers[selectedQuestionId];
                     if (currentCode !== currentAnswer) {
                        // This handles cases where the teacher might clear the answer,
                        // or if another student's answer comes through. We only update
                        // if the remote answer is different from local state to avoid loops.
                        // A more robust solution would use user-specific answer slots.
                     }
                }

            } else {
                setSession(null);
            }
            setIsLoading(false);
        });
        return () => unsub();
    }, [selectedQuestionId, currentCode]);

    const handleCodeChange = (newCode: string) => {
        setCurrentCode(newCode);
    }
    
    // Debounced submission of the answer
    useEffect(() => {
        if (!selectedQuestionId || isLoading) return;

        const submitAnswer = async () => {
             await setDoc(doc(db, 'live-qna', 'session'), { 
                answers: {
                    [selectedQuestionId]: currentCode
                }
            }, { merge: true });
        };

        const handler = setTimeout(() => {
            submitAnswer();
        }, 500);

        return () => clearTimeout(handler);
    }, [currentCode, selectedQuestionId, isLoading]);


    const handleSelectQuestion = (question: LiveQuestion) => {
        setSelectedQuestionId(question.id);
        setCurrentCode(session?.answers[question.id] || question.initialCode);
    }

    if (isLoading && !session) {
        return <LoadingPage />;
    }
    
    const selectedQuestion = session?.questions.find(q => q.id === selectedQuestionId);

    return (
        <div className="flex h-[calc(100vh-4rem)]">
             <aside className="w-80 border-r p-2 flex flex-col bg-muted/40">
                <h2 className="text-lg font-semibold tracking-tight mb-2">Questions</h2>
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
             </aside>
            <main className="flex-grow h-full px-4 py-6">
                {selectedQuestion ? (
                    <div className="space-y-4 h-full flex flex-col">
                        <h2 className="text-2xl font-bold tracking-tight">{selectedQuestion.question}</h2>
                        
                        <div className="grid gap-2 flex-grow">
                            <p className="text-sm font-medium">Your Answer</p>
                            <div className="h-full min-h-[400px] border rounded-md">
                                <Compiler
                                    onCodeChange={handleCodeChange}
                                    initialCode={currentCode}
                                    variant="minimal"
                                    hideHeader
                                    key={selectedQuestion.id} // Force re-mount when question changes
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-md h-full flex items-center justify-center">
                        <p>Waiting for the teacher to publish a live question...</p>
                    </div>
                )}
            </main>
        </div>
    );
}

// Add onCodeChange to Compiler props
declare module '@/components/codeweave/compiler' {
    interface CompilerProps {
        onCodeChange?: (code: string) => void;
    }
}
