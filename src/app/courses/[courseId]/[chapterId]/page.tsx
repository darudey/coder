
'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Video, StickyNote, Code, BrainCircuit, Play, ChevronRight, Grab } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Compiler, type CompilerRef, type RunResult } from '@/components/codeweave/compiler';
import React, { useRef, useState } from 'react';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "@/components/ui/tabs"
import { DotLoader } from '@/components/codeweave/dot-loader';
import { EmbeddedCompiler } from '@/components/codeweave/embedded-compiler';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OutputDisplay } from '@/components/codeweave/output-display';
import { useCourses } from '@/hooks/use-courses';
import { LoadingPage } from '@/components/loading-page';
import { Header } from '@/components/codeweave/header';
import { getYouTubeVideoId } from '@/lib/utils';


interface ChapterPageProps {
  params: {
    courseId: string;
    chapterId: string;
  };
}

export default function ChapterPage({ params: propsParams }: ChapterPageProps) {
  const params = useParams() as { courseId: string; chapterId: string };
  const { courses, loading } = useCourses();
  const course = courses.find((c) => c.id === params.courseId);
  const chapter = course?.chapters.find((ch) => ch.id === params.chapterId);
  
  const syntaxCompilerRef = useRef<CompilerRef>(null);
  const practiceCompilerRef = useRef<CompilerRef>(null);
  
  const [isCompiling, setIsCompiling] = useState(false);
  const [activeTab, setActiveTab] = useState('video');
  const [practiceQuestionIndex, setPracticeQuestionIndex] = useState(0);

  const [output, setOutput] = useState<RunResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);

  const [position, setPosition] = React.useState({ top: 16, left: window.innerWidth - 100 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });
  const elementStartPos = React.useRef({ top: 0, left: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setIsDragging(true);
    dragStartPos.current = { x: clientX, y: clientY };
    elementStartPos.current = { top: position.top, left: position.left };
  };

  const handleMouseMove = React.useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - dragStartPos.current.x;
    const deltaY = clientY - dragStartPos.current.y;

    setPosition({
      top: elementStartPos.current.top + deltaY,
      left: elementStartPos.current.left + deltaX,
    });
  }, [isDragging]);

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove);
      document.addEventListener('touchend', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (loading) {
    return <LoadingPage />;
  }

  if (!course || !chapter) {
    notFound();
  }

  const topic = chapter.topics[0];
  const practiceQuestions = topic?.practice || [];
  const currentPracticeQuestion = practiceQuestions[practiceQuestionIndex];
  const videoId = getYouTubeVideoId(topic?.videoUrl || '');

  const handleRunCode = async () => {
    let ref: React.RefObject<CompilerRef> | null = null;
    if (activeTab === 'syntax') ref = syntaxCompilerRef;
    if (activeTab === 'practice') ref = practiceCompilerRef;

    if (ref?.current) {
        setIsCompiling(true);
        setIsResultOpen(true);
        setOutput(null);

        const result = await ref.current.run();
        setOutput(result);
        setIsCompiling(false);
    }
  }
  
  const handlePrevQuestion = () => {
    setPracticeQuestionIndex(prev => Math.max(0, prev - 1));
  }

  const handleNextQuestion = () => {
    setPracticeQuestionIndex(prev => Math.min(practiceQuestions.length - 1, prev + 1));
  }


  if (!topic) {
    return (
        <>
            <Header variant="page">
              <div className="border rounded-md px-4 py-1.5 bg-muted">
                <h1 className="text-base font-bold tracking-tight">{chapter.title}</h1>
              </div>
            </Header>
            <div className="container mx-auto p-4 md:p-8">
                <p>No topics found for this chapter yet.</p>
                  <div className="mt-8">
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/courses/${course.id}`}>
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Back to {course.title}
                        </Link>
                    </Button>
                </div>
            </div>
        </>
    )
  }

  return (
    <>
      {(activeTab === 'syntax' || activeTab === 'practice') && (
        <Button 
            onClick={handleRunCode} 
            disabled={isCompiling} 
            className="fixed z-50 h-9 px-4 rounded-full shadow-lg"
            style={{ top: position.top, left: position.left, cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
        >
            {isCompiling ? (
                <DotLoader />
            ) : (
                <>
                    <Grab className="w-4 h-4 mr-2 cursor-grab" />
                    <Play className="w-4 h-4" />
                    <span className="ml-1.5 hidden sm:inline">Run</span>
                </>
            )}
        </Button>
      )}
      <div className="flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="video">
            <Header variant="page">
              <div className="border rounded-md px-4 py-1.5 bg-muted min-w-0">
                <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight truncate">{topic.title}</h1>
              </div>
            </Header>
            <div className="container mx-auto px-4 md:px-8">
              <p className="text-muted-foreground text-sm mt-1">{chapter.title}</p>
            </div>
            <TabsList className="grid w-full grid-cols-4 mx-auto max-w-xl sticky top-0 bg-background z-[999] border-b">
                <TabsTrigger value="video"><Video className="w-4 h-4 mr-2" />Video</TabsTrigger>
                <TabsTrigger value="notes"><StickyNote className="w-4 h-4 mr-2" />Notes</TabsTrigger>
                <TabsTrigger value="syntax"><Code className="w-4 h-4 mr-2" />Syntax</TabsTrigger>
                <TabsTrigger value="practice"><BrainCircuit className="w-4 h-4 mr-2" />Practice</TabsTrigger>
            </TabsList>
            <div className="pb-8">
                <TabsContent value="video" className="mt-4">
                    <Card className="rounded-none border-x-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-sm">
                                <Video className="w-5 h-5 text-primary" />
                                Lecture Video
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center justify-center">
                             {videoId ? (
                                <div className="w-full aspect-video max-w-3xl">
                                    <iframe
                                        className="w-full h-full rounded-md"
                                        src={`https://www.youtube.com/embed/${videoId}?rel=0&showinfo=0&modestbranding=1`}
                                        title="YouTube video player"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            ) : (
                                <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center max-w-3xl">
                                    <p className="text-muted-foreground">Video not available or invalid URL.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="notes" className="mt-4">
                    <Card className="rounded-none border-x-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-sm">
                                <StickyNote className="w-5 h-5 text-primary" />
                                Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-auto p-6">
                            <div className="prose dark:prose-invert max-w-none">
                                {topic.notes.map((segment, index) => {
                                    if (segment.type === 'html') {
                                        return <div key={index} dangerouslySetInnerHTML={{ __html: segment.content }} />;
                                    }
                                    if (segment.type === 'code') {
                                        return <EmbeddedCompiler key={index} initialCode={segment.content} />;
                                    }
                                    return null;
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="syntax" className="mt-4 h-full">
                     <Card className="h-full flex flex-col rounded-none border-x-0">
                        <CardContent className="flex-grow overflow-auto p-0">
                            <div className="h-full min-h-[400px]">
                                <Compiler ref={syntaxCompilerRef} initialCode={topic.syntax} variant="minimal" hideHeader />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="practice" className="mt-4 h-full">
                    {currentPracticeQuestion ? (
                        <>
                            <Card className="rounded-none border-x-0 border-t-0">
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle className="text-sm">Practice Question {practiceQuestionIndex + 1}</CardTitle>
                                            <div className="text-sm text-muted-foreground mt-1 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: currentPracticeQuestion.question }} />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="icon" onClick={handlePrevQuestion} disabled={practiceQuestionIndex === 0}>
                                                <ChevronLeft className="w-4 h-4" />
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={handleNextQuestion} disabled={practiceQuestionIndex === practiceQuestions.length - 1}>
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>
                            <Card className="h-full flex flex-col rounded-none border-x-0">
                                <CardContent className="flex-grow overflow-auto p-0">
                                    <div className="h-full min-h-[400px]">
                                    <Compiler ref={practiceCompilerRef} initialCode={currentPracticeQuestion.initialCode} variant="minimal" hideHeader />
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <div className="text-center text-muted-foreground p-8">No practice questions available for this topic yet.</div>
                    )}
                </TabsContent>
            </div>

            <div className="px-4 md:px-8">
                 <Button asChild variant="outline" size="sm">
                    <Link href={`/courses/${course.id}`}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back to {course.title}
                    </Link>
                </Button>
            </div>
        </Tabs>
        <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
            <DialogContent className="max-w-2xl h-3/4 flex flex-col">
            <DialogHeader>
                <DialogTitle>Result</DialogTitle>
            </DialogHeader>
            <div className="flex-grow overflow-hidden">
                <OutputDisplay 
                    output={output} 
                    isCompiling={isCompiling}
                    expectedOutput={activeTab === 'practice' ? currentPracticeQuestion?.expectedOutput : undefined}
                />
            </div>
            </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

    

    