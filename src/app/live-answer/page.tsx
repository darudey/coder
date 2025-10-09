
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';
import { Compiler } from '@/components/codeweave/compiler';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { LoadingPage } from '@/components/loading-page';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

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
    const [session, setSession] = useState<LiveSession | null>(null);
    const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
    const [currentCode, setCurrentCode] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "live-qna", "session"), (doc) => {
            if (doc.exists()) {
                const data = doc.data() as LiveSession;
                setSession(data);
                
                if (!selectedQuestionId && data.questions.length > 0) {
                    const firstQuestionId = data.questions[0].id;
                    setSelectedQuestionId(firstQuestionId);
                    setCurrentCode(data.answers?.[firstQuestionId] || data.questions[0].initialCode);
                }

            } else {
                setSession(null);
            }
            setIsLoading(false);
        });
        return () => unsub();
    }, [selectedQuestionId]);

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
        setCurrentCode(session?.answers?.[question.id] || question.initialCode);
        setIsSidebarOpen(false);
    }

    if (isLoading && !session) {
        return <LoadingPage />;
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
            <main className="flex-grow h-full pt-6">
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
                                    key={selectedQuestion.id} // Force re-mount when question changes
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

// Add onCodeChange to Compiler props
declare module '@/components/codeweave/compiler' {
    interface CompilerProps {
        onCodeChange?: (code: string) => void;
    }
}
