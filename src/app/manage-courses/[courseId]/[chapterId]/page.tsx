
'use client';

import { courses as initialCourses, type Course, type Chapter, type Topic, type NoteSegment, type PracticeQuestion } from '@/lib/courses-data';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Video, StickyNote, Code, BrainCircuit, Save, Plus, Trash2, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Compiler, type CompilerRef } from '@/components/codeweave/compiler';
import React, { useRef, useState, useReducer, useEffect } from 'react';
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

// This is a simplified reducer for state management
function topicReducer(state: Topic, action: { type: string; payload: any }) : Topic {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.payload.field]: action.payload.value };
    case 'SET_PRACTICE_QUESTION':
      const newPractice = [...state.practice];
      newPractice[action.payload.index] = { ...newPractice[action.payload.index], [action.payload.field]: action.payload.value };
      return { ...state, practice: newPractice };
    case 'ADD_PRACTICE_QUESTION':
      return { ...state, practice: [...state.practice, { id: nanoid(), question: '', initialCode: '', expectedOutput: '' }] };
    case 'DELETE_PRACTICE_QUESTION':
        return {...state, practice: state.practice.filter((_, i) => i !== action.payload.index)};
    
    case 'ADD_NOTE_SEGMENT': {
        const { type, index } = action.payload;
        const newSegment: NoteSegment = { type, content: '' };
        const newNotes = [...state.notes];
        newNotes.splice(index + 1, 0, newSegment);
        return { ...state, notes: newNotes };
    }
    case 'UPDATE_NOTE_SEGMENT': {
        const { index, content } = action.payload;
        const newNotes = state.notes.map((segment, i) => 
            i === index ? { ...segment, content } : segment
        );
        return { ...state, notes: newNotes };
    }
    case 'DELETE_NOTE_SEGMENT': {
        const newNotes = state.notes.filter((_, i) => i !== action.payload.index);
        return { ...state, notes: newNotes };
    }
    case 'MOVE_NOTE_SEGMENT': {
        const { index, direction } = action.payload;
        const newNotes = [...state.notes];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newNotes.length) return state;
        const [movedItem] = newNotes.splice(index, 1);
        newNotes.splice(newIndex, 0, movedItem);
        return { ...state, notes: newNotes };
    }

    default:
      return state;
  }
}


interface ManageTopicPageProps {
  params: {
    courseId: string;
    chapterId: string;
  };
}

export default function ManageTopicPage({ params: paramsProp }: ManageTopicPageProps) {
  const params = React.use(paramsProp);
  const { toast } = useToast();
  const course = initialCourses.find((c) => c.id === params.courseId);
  const chapter = course?.chapters.find((ch) => ch.id === params.chapterId);
  
  // For now, we'll just edit the first topic. Topic selection will come next.
  const firstTopic = chapter?.topics[0];

  const [topic, dispatch] = useReducer(topicReducer, firstTopic || {} as Topic);
  const [activeTab, setActiveTab] = useState('video');
  const [practiceQuestionIndex, setPracticeQuestionIndex] = useState(0);

  const syntaxCompilerRef = useRef<CompilerRef>(null);

  useEffect(() => {
    // When switching practice questions, update the syntax editor if needed
    if (activeTab === 'syntax' && syntaxCompilerRef.current) {
        // This is a bit of a hack to force the editor to update.
        // A better solution would involve a key change or a dedicated method.
    }
  }, [practiceQuestionIndex, activeTab]);

  if (!course || !chapter || !topic) {
    notFound();
  }

  const currentPracticeQuestion = topic.practice?.[practiceQuestionIndex];

  const handleFieldChange = (field: keyof Topic, value: any) => {
    dispatch({ type: 'SET_FIELD', payload: { field, value } });
  };
  
  const handlePracticeQuestionChange = (index: number, field: keyof PracticeQuestion, value: string) => {
    dispatch({ type: 'SET_PRACTICE_QUESTION', payload: { index, field, value } });
  };

  const handleAddPracticeQuestion = () => {
    dispatch({ type: 'ADD_PRACTICE_QUESTION', payload: null });
    setPracticeQuestionIndex(topic.practice.length);
  }

  const handleDeletePracticeQuestion = (index: number) => {
    dispatch({ type: 'DELETE_PRACTICE_QUESTION', payload: { index } });
    if (practiceQuestionIndex >= index && practiceQuestionIndex > 0) {
        setPracticeQuestionIndex(prev => prev - 1);
    }
  }

  const handlePrevQuestion = () => {
    setPracticeQuestionIndex(prev => Math.max(0, prev - 1));
  }

  const handleNextQuestion = () => {
    setPracticeQuestionIndex(prev => Math.min((topic.practice?.length || 0) - 1, prev + 1));
  }

  const handleSaveChanges = () => {
    // In a real app, you'd save this to a database.
    // For now, we'll just log it and show a toast.
    console.log('Saving topic:', topic);
    toast({
        title: "Content Saved",
        description: `Changes to "${topic.title}" have been saved locally.`,
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
                        <CardContent className="space-y-4">
                            {(topic.notes || []).map((segment, index) => (
                                <div key={index} className="relative group border rounded-md p-4">
                                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background p-1 rounded-md border">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => dispatch({ type: 'MOVE_NOTE_SEGMENT', payload: { index, direction: 'up' } })} disabled={index === 0}>
                                            <ArrowUp className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => dispatch({ type: 'MOVE_NOTE_SEGMENT', payload: { index, direction: 'down' } })} disabled={index === topic.notes.length - 1}>
                                            <ArrowDown className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => dispatch({ type: 'DELETE_NOTE_SEGMENT', payload: { index } })}>
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>

                                    {segment.type === 'html' ? (
                                        <div className="space-y-2">
                                            <Label>Text Content (HTML/Markdown)</Label>
                                            <Textarea
                                                className="min-h-[120px] font-sans"
                                                value={segment.content}
                                                onChange={(e) => dispatch({ type: 'UPDATE_NOTE_SEGMENT', payload: { index, content: e.target.value } })}
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label>Code Block</Label>
                                            <div className="min-h-[120px]">
                                                <Compiler
                                                    initialCode={segment.content}
                                                    onCodeChange={(code) => dispatch({ type: 'UPDATE_NOTE_SEGMENT', payload: { index, content: code } })}
                                                    variant="minimal"
                                                    hideHeader
                                                    key={`note-compiler-${index}`}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="absolute bottom-[-16px] left-1/2 -translate-x-1/2 w-full flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex items-center bg-background p-1 rounded-full border shadow-md">
                                            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'ADD_NOTE_SEGMENT', payload: { type: 'html', index } })}>
                                                <Plus className="w-3 h-3 mr-1" /> Text
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'ADD_NOTE_SEGMENT', payload: { type: 'code', index } })}>
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
                                        <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'ADD_NOTE_SEGMENT', payload: { type: 'html', index: -1 } })}>
                                            <Plus className="w-3 h-3 mr-1" /> Add Text
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'ADD_NOTE_SEGMENT', payload: { type: 'code', index: -1 } })}>
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
                                    ref={syntaxCompilerRef} 
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

    