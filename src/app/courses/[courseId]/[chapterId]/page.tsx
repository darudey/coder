
'use client';

import { courses } from '@/lib/courses-data';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Video, StickyNote, Code, BrainCircuit, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Compiler, type CompilerRef } from '@/components/codeweave/compiler';
import React, { useRef, useState } from 'react';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "@/components/ui/tabs"
import { DotLoader } from '@/components/codeweave/dot-loader';


interface ChapterPageProps {
  params: {
    courseId: string;
    chapterId: string;
  };
}

export default function ChapterPage({ params: paramsProp }: ChapterPageProps) {
  const params = React.use(paramsProp);
  const course = courses.find((c) => c.id === params.courseId);
  const chapter = course?.chapters.find((ch) => ch.id === params.chapterId);
  const syntaxCompilerRef = useRef<CompilerRef>(null);
  const practiceCompilerRef = useRef<CompilerRef>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [activeTab, setActiveTab] = useState('video');

  if (!course || !chapter) {
    notFound();
  }

  const topic = chapter.topics[0];

  const handleRunCode = async () => {
    const ref = activeTab === 'syntax' ? syntaxCompilerRef : practiceCompilerRef;
    if (ref.current) {
        setIsCompiling(true);
        await ref.current.run();
        setIsCompiling(false);
    }
  }

  if (!topic) {
    return (
        <div className="container mx-auto p-4 md:p-8">
            <p>No topics found for this chapter yet.</p>
        </div>
    )
  }

  return (
    <>
      {(activeTab === 'syntax' || activeTab === 'practice') && (
        <Button onClick={handleRunCode} disabled={isCompiling} className="fixed top-4 right-4 z-50 h-9 px-4">
            {isCompiling ? (
                <DotLoader />
            ) : (
                <>
                    <Play className="w-4 h-4" />
                    <span className="ml-1.5 hidden sm:inline">Run</span>
                </>
            )}
        </Button>
      )}
      <div className="flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="video">
            <header className="mb-4 px-4 md:px-8 pt-4 md:pt-8">
              <Button asChild variant="outline" className="mb-2 h-8 px-2 text-xs">
                <Link href={`/courses/${course.id}`}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back to {course.title}
                </Link>
              </Button>
              <h1 className="text-sm font-bold tracking-tight">{topic.title}</h1>
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
                            <CardTitle className="flex items-center gap-3 text-sm">
                                <Video className="w-5 h-5 text-primary" />
                                Lecture Video
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center justify-center">
                            <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center max-w-3xl">
                                <p className="text-muted-foreground">Video placeholder</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="notes" className="mt-4 px-4 md:px-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-sm">
                                <StickyNote className="w-5 h-5 text-primary" />
                                Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-auto p-6">
                            <div dangerouslySetInnerHTML={{ __html: topic.notes }} className="prose dark:prose-invert max-w-none" />
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
                    <Card className="h-full flex flex-col rounded-none border-x-0">
                        <CardContent className="flex-grow overflow-auto p-0">
                            <div className="h-full min-h-[400px]">
                               <Compiler ref={practiceCompilerRef} initialCode={`// Try it yourself!\n// Modify the code from the previous example.\n\n${topic.syntax}`} variant="minimal" hideHeader />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </div>
        </Tabs>
      </div>
    </>
  );
}
