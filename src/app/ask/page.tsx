'use client';

import { Button } from '@/components/ui/button';
import { Play, Loader2, Plus, Trash2, PanelLeft, Share2 } from 'lucide-react';
import { Compiler, type CompilerRef, type RunResult } from '@/components/codeweave/compiler';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, addDoc, collection, updateDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { nanoid } from 'nanoid';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { OutputDisplay } from '@/components/codeweave/output-display';
import { DotLoader } from '@/components/codeweave/dot-loader';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Copy } from 'lucide-react';

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


export default function AskQuestionPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [session, setSession] = useState<LiveSession | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const solutionCompilerRef = useRef<CompilerRef>(null);
  const [solutionOutput, setSolutionOutput] = useState<RunResult | null>(null);
  const [isSolutionRunning, setIsSolutionRunning] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sessionCode, setSessionCode] = useState('');

  // Effect to load and subscribe to the session
  useEffect(() => {
    if (!user) return;
    const sessionDocId = `teacher_draft_${user.uid}`;
    
    const unsub = onSnapshot(doc(db, "live-qna", sessionDocId), (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data() as LiveSession;
            setSession(data);
            if (!selectedQuestionId && data.questions.length > 0) {
                setSelectedQuestionId(data.questions[0].id);
            } else if (selectedQuestionId && !data.questions.some(q => q.id === selectedQuestionId)) {
                // If current selection is deleted, select first
                setSelectedQuestionId(data.questions[0]?.id || null);
            } else if (data.questions.length === 0) {
                 setSelectedQuestionId(null);
            }
        } else {
            const defaultQuestionId = nanoid();
            const defaultSession: LiveSession = {
                questions: [{
                    id: defaultQuestionId,
                    question: 'print your name',
                    initialCode: `// Create a function to print your name\nfunction printName(name) {\n  console.log(name);\n}\n\n// Call the function with your name`,
                    solutionCode: `function printName(name) {\n  console.log(name);\n}\n\nprintName('Alex');`
                }],
                answers: {}
            };
            setDoc(doc(db, "live-qna", sessionDocId), defaultSession);
            // Firestore will trigger the snapshot listener again with the new data
        }
    });
    return () => unsub();
  }, [user, selectedQuestionId]);
  
  const handleDebouncedSave = useCallback(() => {
    if (!session || !user) return;
    const sessionDocId = `teacher_draft_${user.uid}`;
    setDoc(doc(db, 'live-qna', sessionDocId), session, { merge: true });
  }, [session, user]);

  // Debounced save effect
  useEffect(() => {
    if (!session) return;
    const handler = setTimeout(() => {
        handleDebouncedSave();
    }, 1000); 
    return () => clearTimeout(handler);
  }, [session, handleDebouncedSave]);

  const handlePublishSession = async () => {
    if (!session || !user) return;
    setIsPublishing(true);

    const newSessionCode = nanoid(6);
    try {
        await setDoc(doc(db, 'live-sessions', newSessionCode), {
            teacherId: user.uid,
            studentId: null,
            isUsed: false,
            questions: session.questions,
            answers: {},
        });

        setSessionCode(newSessionCode);
        setShareDialogOpen(true);

        toast({
            title: "Session Published",
            description: "Share the code with your student to begin.",
        });
    } catch (e) {
        console.error("Failed to publish session: ", e);
        toast({
            title: "Error",
            description: "Could not publish the session. Please try again.",
            variant: "destructive",
        });
    }
    setIsPublishing(false);
  };
  
  const handleAddQuestion = () => {
    const newQuestionId = nanoid();
    const newQuestion: LiveQuestion = {
        id: newQuestionId,
        question: 'New Question',
        initialCode: '// Your code here',
        solutionCode: '// Solution'
    };
    setSession(prev => {
        const newQuestions = [...(prev?.questions || []), newQuestion];
        const newSession = {
            ...(prev || { answers: {} }),
            questions: newQuestions
        };
        return newSession;
    });
    setSelectedQuestionId(newQuestionId);
  };

  const handleDeleteQuestion = (idToDelete: string) => {
    if (!session || session.questions.length <= 1) {
        toast({ title: "Cannot delete the last question.", variant: 'destructive' });
        return;
    }

    setSession(prev => {
        if (!prev) return null;
        const newQuestions = prev.questions.filter(q => q.id !== idToDelete);
        
        if(selectedQuestionId === idToDelete) {
            setSelectedQuestionId(newQuestions[0]?.id || null);
        }

        return {...prev, questions: newQuestions};
    });
  };

  const updateQuestionField = (questionId: string, field: keyof Omit<LiveQuestion, 'id'>, value: string) => {
      setSession(prev => {
          if (!prev) return null;
          const newQuestions = prev.questions.map(q => 
            q.id === questionId ? { ...q, [field]: value } : q
          );
          return {
              ...prev,
              questions: newQuestions
          }
      });
  };

  const handleRunSolution = async () => {
    if (solutionCompilerRef.current) {
        setIsSolutionRunning(true);
        setIsResultOpen(true);
        setSolutionOutput(null);

        const result = await solutionCompilerRef.current.run();
        setSolutionOutput(result);
        setIsSolutionRunning(false);
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    toast({ title: "Copied!", description: "Session code copied to clipboard." });
  }

  const selectedQuestion = session?.questions.find(q => q.id === selectedQuestionId);
  const studentAnswer = selectedQuestionId ? session?.answers[selectedQuestionId] || '// Waiting for student answer...' : '// Waiting for student answer...';

  const QuestionList = () => (
     <div className="p-2 flex flex-col h-full bg-muted/40">
        <div className="flex items-center justify-between mb-2 px-2 relative h-8">
            <h2 className="text-lg font-semibold tracking-tight">Questions</h2>
            <div className="absolute left-1/2 -translate-x-1/2">
                <Button size="icon" variant="ghost" onClick={handleAddQuestion} className="h-7 w-7">
                    <Plus className="w-4 h-4" />
                </Button>
            </div>
        </div>
        <ScrollArea className="flex-grow">
            <div className="space-y-1">
            {session?.questions.map((q, index) => (
                <div key={q.id} className={cn(
                    "flex items-center justify-between p-2 rounded-md cursor-pointer group",
                    selectedQuestionId === q.id ? 'bg-primary/20' : 'hover:bg-accent'
                )} onClick={() => {
                    setSelectedQuestionId(q.id);
                    setIsSidebarOpen(false);
                }}>
                    <p className="text-sm font-medium truncate flex-grow">
                       {index + 1}. {q.question}
                    </p>
                    <Button 
                        size="icon" variant="ghost" 
                        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuestion(q.id);
                        }}
                    >
                        <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                </div>
            ))}
            </div>
        </ScrollArea>
      </div>
  )

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
             <Tabs defaultValue="question" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="question">Question</TabsTrigger>
                    <TabsTrigger value="solution">Solution</TabsTrigger>
                    <TabsTrigger value="answer">Answer</TabsTrigger>
                </TabsList>
                <TabsContent value="question" className="flex-grow mt-0">
                    <div className="flex flex-col h-full gap-4 pt-4">
                        <div className="grid gap-2 px-4">
                            <Label htmlFor="live-question">Question Text</Label>
                            <Textarea 
                                id="live-question"
                                placeholder="What does this code do?"
                                value={selectedQuestion.question}
                                onChange={(e) => updateQuestionField(selectedQuestion.id, 'question', e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2 flex-grow">
                            <Label className="px-4">Initial Code (for student)</Label>
                            <div className="h-full min-h-[300px]">
                                <Compiler 
                                    onCodeChange={(code) => updateQuestionField(selectedQuestion.id, 'initialCode', code)}
                                    initialCode={selectedQuestion.initialCode} 
                                    variant="minimal" hideHeader 
                                    key={`${selectedQuestion.id}-initial`}
                                />
                            </div>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="solution" className="flex-grow mt-0">
                    <div className="flex flex-col h-full gap-4 pt-4">
                        <div className="flex justify-between items-center px-4">
                            <Label>Solution Code</Label>
                            <Button size="sm" onClick={handleRunSolution} disabled={isSolutionRunning}>
                                {isSolutionRunning ? <DotLoader /> : <Play className="w-4 h-4 mr-2" />}
                                Run Solution
                            </Button>
                        </div>
                        <div className="grid gap-2 flex-grow">
                            <div className="h-full min-h-[300px]">
                                <Compiler
                                    ref={solutionCompilerRef}
                                    onCodeChange={(code) => updateQuestionField(selectedQuestion.id, 'solutionCode', code)}
                                    initialCode={selectedQuestion.solutionCode}
                                    variant="minimal" hideHeader
                                    key={`${selectedQuestion.id}-solution`}
                                />
                            </div>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="answer" className="flex-grow mt-0">
                    <div className="flex flex-col h-full gap-4 pt-4">
                        <div className="grid gap-2 flex-grow">
                        <Label className="px-4">Submitted Code</Label>
                            <div className="h-full min-h-[300px]">
                            <Compiler
                                initialCode={studentAnswer}
                                variant="minimal" hideHeader
                                key={studentAnswer} 
                            />
                        </div>
                    </div>
                    </div>
                </TabsContent>
            </Tabs>
        ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No question selected. Add or select a question to begin.</p>
            </div>
        )}
      </main>
       <div className="fixed bottom-4 right-4 z-50">
            <Button onClick={handlePublishSession} disabled={isPublishing || !session} size="lg" className="rounded-full shadow-lg">
                {isPublishing ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Publishing...
                    </>
                ) : (
                    <>
                        <Share2 className="w-4 h-4 mr-2" />
                        Publish Session
                    </>
                )}
            </Button>
        </div>
        <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
            <DialogContent className="max-w-2xl h-3/4 flex flex-col">
            <DialogHeader>
                <DialogTitle>Solution Result</DialogTitle>
                <DialogDescription>
                    This is the output of your solution code.
                </DialogDescription>
            </DialogHeader>
            <div className="flex-grow overflow-hidden">
                <OutputDisplay 
                    output={solutionOutput} 
                    isCompiling={isSolutionRunning}
                />
            </div>
            </DialogContent>
        </Dialog>
         <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogContent>
            <DialogHeader>
                <DialogTitle>Session Published!</DialogTitle>
                <DialogDescription>
                    Share this one-time code with your student to start the session.
                </DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2 pt-2">
                <Input value={sessionCode} readOnly className="font-mono text-lg tracking-widest" />
                <Button onClick={handleCopyCode} size="icon" className="shrink-0" disabled={!sessionCode}>
                    <Copy className="h-4 w-4" />
                </Button>
            </div>
            </DialogContent>
        </Dialog>
    </div>
  );
}

declare module '@/components/codeweave/compiler' {
    interface CompilerProps {
        onCodeChange?: (code: string) => void;
    }
}
