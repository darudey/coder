
'use client';

import { type Topic, type NoteSegment, type PracticeQuestion } from '@/lib/courses-data';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Video, StickyNote, Code, BrainCircuit, Save, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Compiler, type CompilerRef } from '@/components/codeweave/compiler';
import React, { useRef, useState, useEffect } from 'react';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "@/components/ui/tabs"
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { useCourses } from '@/hooks/use-courses';
import { ChevronRight } from 'lucide-react';


const AutoResizingTextarea = ({ value, onChange, className }: { value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; className?: string }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [value]);

    return (
        <Textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            className={className}
            rows={1}
        />
    );
};


interface ManageTopicPageProps {
  params: {
    courseId: string;
    chapterId: string;
  };
}

export default function ManageTopicPage({ params }: ManageTopicPageProps) {
  const { toast } = useToast();
  const { courses, updateTopic } = useCourses();
  const router = useRouter();

  const [course, setCourse] = useState(() => courses.find((c) => c.id === params.courseId));
  const [chapter, setChapter] = useState(() => course?.chapters.find((ch) => ch.id === params.chapterId));
  const [topic, setTopic] = useState(() => chapter?.topics[0]);
  
  const [activeTab, setActiveTab] = useState('video');
  const [practiceQuestionIndex, setPracticeQuestionIndex] = useState(0);

  const syntaxCompilerRef = useRef<CompilerRef>(null);
  
  useEffect(() => {
    const foundCourse = courses.find((c) => c.id === params.courseId);
    setCourse(foundCourse);
    const foundChapter = foundCourse?.chapters.find((ch) => ch.id === params.chapterId);
    setChapter(foundChapter);
    const foundTopic = foundChapter?.topics[0];
    setTopic(foundTopic ? { ...foundTopic } : undefined); // Create a mutable copy
  }, [params.courseId, params.chapterId, courses]);

  if (!course || !chapter || !topic) {
    // This can flash briefly while state is setting, which is fine
    return null;
  }

  const currentPracticeQuestion = topic.practice?.[practiceQuestionIndex];

  const handleFieldChange = (field: keyof Topic, value: any) => {
    setTopic(prev => prev ? { ...prev, [field]: value } : undefined);
  };
  
  const handlePracticeQuestionChange = (index: number, field: keyof PracticeQuestion, value: string) => {
    setTopic(prev => {
        if (!prev) return undefined;
        const newPractice = [...prev.practice];
        newPractice[index] = { ...newPractice[index], [field]: value };
        return { ...prev, practice: newPractice };
    });
  };

  const handleAddPracticeQuestion = () => {
    setTopic(prev => {
        if (!prev) return undefined;
        const newPractice = [...prev.practice, { id: nanoid(), question: '', initialCode: '', expectedOutput: '' }];
        setPracticeQuestionIndex(newPractice.length - 1);
        return { ...prev, practice: newPractice };
    });
  }

  const handleDeletePracticeQuestion = (index: number) => {
    setTopic(prev => {
        if (!prev) return undefined;
        const newPractice = prev.practice.filter((_, i) => i !== index);
        if (practiceQuestionIndex >= index && practiceQuestionIndex > 0) {
            setPracticeQuestionIndex(p => p - 1);
        }
        return { ...prev, practice: newPractice };
    });
  }

  const handleNoteSegmentChange = (index: number, content: string) => {
      setTopic(prev => {
          if (!prev) return undefined;
          const newNotes = prev.notes.map((segment, i) => i === index ? { ...segment, content } : segment);
          return { ...prev, notes: newNotes };
      })
  }

  const handleAddNoteSegment = (type: 'html' | 'code', index: number) => {
      setTopic(prev => {
          if (!prev) return undefined;
          const newSegment: NoteSegment = { type, content: '' };
          const newNotes = [...prev.notes];
          newNotes.splice(index + 1, 0, newSegment);
          return { ...prev, notes: newNotes };
      });
  }

  const handleDeleteNoteSegment = (index: number) => {
      setTopic(prev => {
          if (!prev) return undefined;
          const newNotes = prev.notes.filter((_, i) => i !== index);
          return { ...prev, notes: newNotes };
      });
  }

    const handleMoveNoteSegment = (index: number, direction: 'up' | 'down') => {
        setTopic(prev => {
            if (!prev) return undefined;
            const newNotes = [...prev.notes];
            const newIndex = direction === 'up' ? index - 1 : index + 1;
            if (newIndex < 0 || newIndex >= newNotes.length) return prev;
            const [movedItem] = newNotes.splice(index, 1);
            newNotes.splice(newIndex, 0, movedItem);
            return { ...prev, notes: newNotes };
        });
    };


  const handlePrevQuestion = () => {
    setPracticeQuestionIndex(prev => Math.max(0, prev - 1));
  }

  const handleNextQuestion = () => {
    setPracticeQuestionIndex(prev => Math.min((topic.practice?.length || 0) - 1, prev + 1));
  }

  const handleSaveChanges = () => {
    if (!topic) return;
    updateTopic(course!.id, chapter!.id, topic.id, topic);
    toast({
        title: "Content Saved",
        description: `Changes to "${topic.title}" have been saved.`,
    });
  }

  return (
    <>
      <Button onClick={handleSaveChanges} className="fixed top-[56px] right-4 z-50 h-9 px-4">
          <Save className="w-4 h-4" />
          <span className="ml-1.5 hidden sm:inline">Save Changes</span>
      </Button>
      <div className="flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="video">
            <header className="mb-4 px-4 md:px-8 pt-4 md:pt-8">
              <Button asChild variant="outline" className="mb-2 h-8 px-2 text-xs">
                <Link href={`/manage-courses/${course.id}`}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back to {course.title}
                </Link>
              </Button>
              <Input 
                className="text-lg font-bold tracking-tight h-auto p-0 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                value={topic.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
              />
              <p className="text-muted-foreground text-xs mt-1">{chapter.title}</p>
            </header>
            <TabsList className="grid w-full grid-cols-4 mx-auto max-w-xl sticky top-0 bg-background z-30">
                <TabsTrigger value="video"><Video className="w-4 h-4 mr-2" />Video</TabsTrigger>
                <TabsTrigger value="notes"><StickyNote className="w-4 h-4 mr-2" />Notes</TabsTrigger>
                <TabsTrigger value="syntax"><Code className="w-4 h-4 mr-2" />Syntax</TabsTrigger>
                <TabsTrigger value="practice"><BrainCircuit className="w-4 h-4 mr-2" />Practice</TabsTrigger>
            </TabsList>
            <div className="pb-8">
                <TabsContent value="video" className="mt-4 px-4 md:px-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Lecture Video</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="video-url">YouTube Video URL</Label>
                                <Input 
                                    id="video-url" 
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    value={topic.videoUrl || ''}
                                    onChange={(e) => handleFieldChange('videoUrl', e.target.value)}
                                />
                            </div>
                            <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center max-w-3xl">
                                <p className="text-muted-foreground">Video preview placeholder</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="notes" className="mt-4 px-4 md:px-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Topic Notes</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-0">
                            {(topic.notes || []).map((segment, index) => (
                                <div key={index} className="relative group border rounded-md">
                                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background p-1 rounded-md border">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveNoteSegment(index, 'up')} disabled={index === 0}>
                                            <ArrowUp className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveNoteSegment(index, 'down')} disabled={index === topic.notes.length - 1}>
                                            <ArrowDown className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteNoteSegment(index)}>
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>

                                    {segment.type === 'html' ? (
                                        <AutoResizingTextarea
                                            className="min-h-[120px] w-full overflow-hidden resize-none"
                                            value={segment.content}
                                            onChange={(e) => handleNoteSegmentChange(index, e.target.value)}
                                        />
                                    ) : (
                                        <div className="space-y-2 p-4">
                                            <Label>Code Block</Label>
                                            <div className="min-h-[120px]">
                                                <Compiler
                                                    initialCode={segment.content}
                                                    onCodeChange={(code) => handleNoteSegmentChange(index, code)}
                                                    variant="minimal"
                                                    hideHeader
                                                    key={`note-compiler-${index}`}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="absolute bottom-[-16px] left-1/2 -translate-x-1/2 w-full flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex items-center bg-background p-1 rounded-full border shadow-md">
                                            <Button variant="ghost" size="sm" onClick={() => handleAddNoteSegment('html', index)}>
                                                <Plus className="w-3 h-3 mr-1" /> Text
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleAddNoteSegment('code', index)}>
                                                <Plus className="w-3 h-3 mr-1" /> Code
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                             {(topic.notes?.length || 0) === 0 && (
                                <div className="text-center text-muted-foreground p-4 border-2 border-dashed rounded-md">
                                    <p>No content yet. Add your first block.</p>
                                     <div className="flex items-center justify-center gap-2 mt-2">
                                        <Button variant="outline" size="sm" onClick={() => handleAddNoteSegment('html', -1)}>
                                            <Plus className="w-3 h-3 mr-1" /> Add Text
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleAddNoteSegment('code', -1)}>
                                            <Plus className="w-3 h-3 mr-1" /> Add Code
                                        </Button>
                                    </div>
                                </div>
                             )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="syntax" className="mt-4 h-full">
                     <Card className="h-full flex flex-col rounded-none border-x-0">
                        <CardHeader>
                            <CardTitle className="text-sm px-6">Syntax Example</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow overflow-auto p-0">
                            <div className="h-full min-h-[400px]">
                                <Compiler 
                                    initialCode={topic.syntax} 
                                    variant="minimal" 
                                    hideHeader 
                                    key={topic.id} // Force re-mount on topic change
                                    onCodeChange={(code) => handleFieldChange('syntax', code)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="practice" className="mt-4 h-full">
                    {currentPracticeQuestion ? (
                        <>
                            <Card className="rounded-none border-x-0 border-t-0">
                                <CardHeader>
                                    <div className="flex justify-between items-center mb-4">
                                        <CardTitle className="text-sm">Practice Questions</CardTitle>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="icon" onClick={handlePrevQuestion} disabled={practiceQuestionIndex === 0}>
                                                <ChevronLeft className="w-4 h-4" />
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={handleNextQuestion} disabled={practiceQuestionIndex === (topic.practice?.length || 0) - 1}>
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                            <Button variant="outline" onClick={handleAddPracticeQuestion}>
                                                <Plus className="w-4 h-4 mr-2" /> Add
                                            </Button>
                                            <Button variant="destructive" size="icon" onClick={() => handleDeletePracticeQuestion(practiceQuestionIndex)} disabled={(topic.practice?.length || 0) <= 1}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor={`pq-question-${practiceQuestionIndex}`}>Question {practiceQuestionIndex + 1}</Label>
                                        <Textarea 
                                            id={`pq-question-${practiceQuestionIndex}`}
                                            placeholder="What does this code do?"
                                            value={currentPracticeQuestion.question}
                                            onChange={(e) => handlePracticeQuestionChange(practiceQuestionIndex, 'question', e.target.value)}
                                        />
                                    </div>
                                </CardHeader>
                            </Card>
                            <div className="grid grid-cols-1 md:grid-cols-2">
                                <Card className="h-full flex flex-col rounded-none border-x-0">
                                    <CardHeader><CardTitle className="text-sm">Initial Code</CardTitle></CardHeader>
                                    <CardContent className="flex-grow overflow-auto p-0">
                                        <div className="h-full min-h-[300px]">
                                            <Compiler 
                                                initialCode={currentPracticeQuestion.initialCode} 
                                                variant="minimal" hideHeader 
                                                key={`initial-${currentPracticeQuestion.id}`}
                                                onCodeChange={(code) => handlePracticeQuestionChange(practiceQuestionIndex, 'initialCode', code)}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="h-full flex flex-col rounded-none border-x-0 border-l">
                                    <CardHeader><CardTitle className="text-sm">Expected Output</CardTitle></CardHeader>
                                    <CardContent className="flex-grow overflow-auto p-0">
                                         <div className="h-full min-h-[300px]">
                                            <Compiler 
                                                initialCode={currentPracticeQuestion.expectedOutput} 
                                                variant="minimal" hideHeader 
                                                key={`expected-${currentPracticeQuestion.id}`}
                                                onCodeChange={(code) => handlePracticeQuestionChange(practiceQuestionIndex, 'expectedOutput', code)}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-muted-foreground p-8">
                            <p>No practice questions for this topic yet.</p>
                            <Button className="mt-4" onClick={handleAddPracticeQuestion}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add First Question
                            </Button>
                        </div>
                    )}
                </TabsContent>
            </div>
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
