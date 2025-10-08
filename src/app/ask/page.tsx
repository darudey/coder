
'use client';

import { type Topic, type PracticeQuestion, type Course, type Chapter } from '@/lib/courses-data';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Save, Plus, Trash2, Play, Check, Loader2, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Compiler, type CompilerRef, type RunResult } from '@/components/codeweave/compiler';
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { useCourses } from '@/hooks/use-courses';
import { DotLoader } from '@/components/codeweave/dot-loader';
import { LoadingPage } from '@/components/loading-page';
import { Header } from '@/components/codeweave/header';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AskQuestionPage() {
  const { toast } = useToast();
  const { courses, loading: coursesLoading } = useCourses();
  
  const [selectedCourseId, setSelectedCourseId] = React.useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = React.useState<string | null>(null);
  
  const [questions, setQuestions] = React.useState<PracticeQuestion[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = React.useState(0);
  
  const [isCompiling, setIsCompiling] = React.useState(false);
  const solutionCompilerRef = React.useRef<CompilerRef>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const selectedChapter = selectedCourse?.chapters.find(c => c.id === selectedChapterId);
  // For simplicity, we'll associate questions with the first topic of a chapter.
  const targetTopic = selectedChapter?.topics[0];

  React.useEffect(() => {
    if (targetTopic) {
      setQuestions(targetTopic.practice.map(q => ({...q, id: q.id || nanoid()})));
      setActiveQuestionIndex(0);
      setHasUnsavedChanges(false);
    } else {
      setQuestions([]);
    }
  }, [targetTopic]);

  const markAsDirty = () => setHasUnsavedChanges(true);

  const handleQuestionChange = (index: number, field: keyof PracticeQuestion, value: string) => {
    setQuestions(prevQuestions => {
      const newQuestions = [...prevQuestions];
      newQuestions[index] = { ...newQuestions[index], [field]: value };
      return newQuestions;
    });
    markAsDirty();
  };

  const handleRunSolution = async () => {
    if (solutionCompilerRef.current) {
        setIsCompiling(true);
        const result = await solutionCompilerRef.current.run();
        handleQuestionChange(activeQuestionIndex, 'expectedOutput', result.output);
        setIsCompiling(false);
        toast({
            title: "Expected Output Updated",
            description: "The output from the solution code has been saved.",
        })
    }
  }

  const handleAddQuestion = () => {
    const newQuestion: PracticeQuestion = { id: nanoid(), question: '', initialCode: '// Your code here', solutionCode: '// Your solution here', expectedOutput: '' };
    setQuestions(prev => [...prev, newQuestion]);
    setActiveQuestionIndex(questions.length);
    markAsDirty();
  }

  const handleDeleteQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
    if (activeQuestionIndex >= index && activeQuestionIndex > 0) {
        setActiveQuestionIndex(p => p - 1);
    }
    markAsDirty();
  }
  
  const handlePrevQuestion = () => setActiveQuestionIndex(prev => Math.max(0, prev - 1));
  const handleNextQuestion = () => setActiveQuestionIndex(prev => Math.min(questions.length - 1, prev + 1));

  const handleSaveChanges = async () => {
    if (!selectedCourse || !selectedChapter || !targetTopic) {
        toast({ title: "Error", description: "Please select a course and chapter.", variant: "destructive" });
        return;
    }
    setIsSaving(true);
    
    // Gather code from the active compiler ref
    const finalQuestions = questions.map((pq, index) => {
        if (index === activeQuestionIndex && solutionCompilerRef.current) {
            return { ...pq, solutionCode: solutionCompilerRef.current.getCode() };
        }
        return pq;
    });
    
    const updatedTopic = { ...targetTopic, practice: finalQuestions };
    
    const updatedCourse = {
        ...selectedCourse,
        chapters: selectedCourse.chapters.map(chap => {
            if (chap.id !== selectedChapter.id) return chap;
            return {
                ...chap,
                topics: chap.topics.map(t => t.id === updatedTopic.id ? updatedTopic : t)
            };
        })
    };
    
    try {
        await setDoc(doc(db, 'courses', selectedCourse.id), updatedCourse);
        
        // This won't update the local state in useCourses hook, a full reload or more complex state management would be needed for instant reflection on other pages.
        
        setIsSaving(false);
        setHasUnsavedChanges(false);
        toast({
            title: "Changes Saved",
            description: `Questions for ${selectedCourse.title} / ${selectedChapter.title} have been updated.`,
        });
    } catch (e) {
        console.error("Failed to save changes: ", e);
        setIsSaving(false);
        toast({
            title: "Error Saving",
            description: "Could not save your changes. Please try again.",
            variant: "destructive",
        });
    }
  }

  const currentQuestion = questions[activeQuestionIndex];

  if (coursesLoading) {
      return <LoadingPage />;
  }

  return (
    <>
      <Header variant="page">
        <div className="border rounded-md px-4 py-1.5 bg-muted min-w-0">
            <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight truncate">Ask a Question</h1>
        </div>
      </Header>

      <div className="container mx-auto p-4 md:p-8">
        <Card className="mb-8">
            <CardHeader>
                <CardTitle>Select Target</CardTitle>
                <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Course</Label>
                            <Select onValueChange={setSelectedCourseId} value={selectedCourseId || undefined}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a course..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {courses.map(course => (
                                        <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Chapter</Label>
                            <Select onValueChange={setSelectedChapterId} value={selectedChapterId || undefined} disabled={!selectedCourse}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a chapter..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {selectedCourse?.chapters.map(chapter => (
                                        <SelectItem key={chapter.id} value={chapter.id}>{chapter.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </CardHeader>
        </Card>

        {selectedChapter && targetTopic ? (
            currentQuestion ? (
                <>
                    <Card className="rounded-b-none">
                        <CardHeader>
                            <div className="flex justify-between items-center mb-4">
                                <CardTitle className="text-sm">Practice Questions</CardTitle>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="icon" onClick={handlePrevQuestion} disabled={activeQuestionIndex === 0}>
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={handleNextQuestion} disabled={activeQuestionIndex === questions.length - 1}>
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" onClick={handleAddQuestion}>
                                        <Plus className="w-4 h-4 mr-2" /> Add
                                    </Button>
                                    <Button variant="destructive" size="icon" onClick={() => handleDeleteQuestion(activeQuestionIndex)} disabled={questions.length <= 1}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor={`pq-question-${activeQuestionIndex}`}>Question {activeQuestionIndex + 1}</Label>
                                <Textarea 
                                    id={`pq-question-${activeQuestionIndex}`}
                                    placeholder="What does this code do?"
                                    value={currentQuestion.question}
                                    onChange={(e) => handleQuestionChange(activeQuestionIndex, 'question', e.target.value)}
                                />
                            </div>
                        </CardHeader>
                    </Card>
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        <Card className="h-full flex flex-col rounded-none border-t-0">
                            <CardHeader><CardTitle className="text-sm">Initial Code (for student)</CardTitle></CardHeader>
                            <CardContent className="flex-grow overflow-auto p-0">
                                <div className="h-full min-h-[300px]">
                                    <Compiler 
                                        onCodeChange={(code) => handleQuestionChange(activeQuestionIndex, 'initialCode', code)}
                                        initialCode={currentQuestion.initialCode} 
                                        variant="minimal" hideHeader 
                                        key={`initial-${currentQuestion.id}`}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                            <Card className="h-full flex flex-col rounded-none border-t-0 border-l">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-sm">Solution Code</CardTitle>
                                <Button size="sm" onClick={handleRunSolution} disabled={isCompiling}>
                                    {isCompiling ? <DotLoader /> : <Play className="w-4 h-4 mr-2" />}
                                    Run to Get Output
                                </Button>
                            </CardHeader>
                            <CardContent className="flex-grow overflow-auto p-0">
                                <div className="h-full min-h-[300px]">
                                    <Compiler
                                        ref={solutionCompilerRef}
                                        onCodeChange={markAsDirty}
                                        initialCode={currentQuestion.solutionCode}
                                        variant="minimal" hideHeader
                                        key={`solution-${currentQuestion.id}`}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                        <Card className="h-full flex flex-col rounded-t-none border-t">
                        <CardHeader><CardTitle className="text-sm">Expected Output (Auto-generated)</CardTitle></CardHeader>
                        <CardContent className="flex-grow overflow-auto p-4 bg-muted/50">
                            <Textarea
                                className="w-full h-full min-h-[100px] resize-none focus-visible:ring-0 focus-visible:ring-offset-0 border-0 p-0 font-code text-sm bg-transparent"
                                value={currentQuestion.expectedOutput}
                                readOnly
                                placeholder="Run the solution code to generate this..."
                            />
                        </CardContent>
                    </Card>
                </>
            ) : (
                <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-md">
                    <p>No practice questions for this topic yet.</p>
                    <Button className="mt-4" onClick={handleAddQuestion}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add First Question
                    </Button>
                </div>
            )
        ) : (
            <div className="text-center text-muted-foreground p-8 border-2 border-dashed rounded-md">
                <p>Select a course and chapter to start managing questions.</p>
            </div>
        )}
      </div>

      <div className="fixed top-20 right-8 z-50">
        {!hasUnsavedChanges ? (
            <Button disabled size="lg" className="rounded-full shadow-lg">
                <Check className="w-5 h-5 mr-2" />
                Saved
            </Button>
        ) : (
            <Button onClick={handleSaveChanges} disabled={isSaving} size="lg" className="rounded-full shadow-lg">
                {isSaving ? (
                    <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Saving...
                    </>
                ) : (
                    <>
                        <Save className="w-5 h-5 mr-2" />
                        Save Changes
                    </>
                )}
            </Button>
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
