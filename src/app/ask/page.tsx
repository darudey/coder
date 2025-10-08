
'use client';

import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Compiler, type CompilerRef } from '@/components/codeweave/compiler';
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/codeweave/header';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AskQuestionPage() {
  const { toast } = useToast();
  
  const [question, setQuestion] = React.useState('');
  const [initialCode, setInitialCode] = React.useState('// Your code here');
  const [solutionCode, setSolutionCode] = React.useState('// Solution code');
  const [studentAnswer, setStudentAnswer] = React.useState('// Waiting for student answer...');

  const [isPublishing, setIsPublishing] = React.useState(false);

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, "live-qna", "answer"), (doc) => {
        if (doc.exists()) {
            setStudentAnswer(doc.data().code);
        }
    });
    return () => unsub();
  }, []);


  const handlePublishQuestion = async () => {
    setIsPublishing(true);
    try {
        await setDoc(doc(db, 'live-qna', 'question'), {
            question,
            initialCode,
            solutionCode,
        });
        toast({
            title: "Question Published",
            description: "The question is now live for students.",
        });
    } catch (e) {
        console.error("Failed to publish question: ", e);
        toast({
            title: "Error",
            description: "Could not publish the question. Please try again.",
            variant: "destructive",
        });
    }
    setIsPublishing(false);
  }

  return (
    <>
      <Header variant="page">
        <div className="border rounded-md px-4 py-1.5 bg-muted min-w-0">
            <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight truncate">Ask a Live Question</h1>
        </div>
      </Header>

      <div className="space-y-4">
        <Tabs defaultValue="question">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="question">Question</TabsTrigger>
                <TabsTrigger value="solution">Solution</TabsTrigger>
                <TabsTrigger value="studentAnswer">Student's Answer</TabsTrigger>
            </TabsList>
            <TabsContent value="question" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Compose Question</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="live-question">Question Text</Label>
                            <Textarea 
                                id="live-question"
                                placeholder="What does this code do?"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Initial Code (for student)</Label>
                            <div className="h-full min-h-[300px] border rounded-md">
                                <Compiler 
                                    onCodeChange={setInitialCode}
                                    initialCode={initialCode} 
                                    variant="minimal" hideHeader 
                                    key="initial-code"
                                />
                            </div>
                        </div>
                         <Button onClick={handlePublishQuestion} disabled={isPublishing}>
                            {isPublishing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Publishing...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4 mr-2" />
                                    Publish Question
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="solution" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>Your Solution</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Solution Code</Label>
                             <div className="h-full min-h-[300px] border rounded-md">
                                <Compiler
                                    onCodeChange={setSolutionCode}
                                    initialCode={solutionCode}
                                    variant="minimal" hideHeader
                                    key="solution-code"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="studentAnswer" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>Student's Answer</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="grid gap-2">
                            <Label>Submitted Code</Label>
                             <div className="h-full min-h-[300px] border rounded-md bg-muted/50">
                                <Compiler
                                    initialCode={studentAnswer}
                                    variant="minimal" hideHeader
                                    key={studentAnswer} // Re-mount compiler when answer changes
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
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
