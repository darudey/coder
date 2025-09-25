
'use client';

import { courses } from '@/lib/courses-data';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Video, StickyNote, Code, BrainCircuit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Compiler } from '@/components/codeweave/compiler';
import React from 'react';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "@/components/ui/tabs"


interface ChapterPageProps {
  params: {
    courseId: string;
    chapterId: string;
  };
}

export default function ChapterPage({ params }: ChapterPageProps) {
  const course = courses.find((c) => c.id === params.courseId);
  const chapter = course?.chapters.find((ch) => ch.id === params.chapterId);

  if (!course || !chapter) {
    notFound();
  }

  const topic = chapter.topics[0];

  if (!topic) {
    return (
        <div className="container mx-auto p-4 md:p-8">
            <p>No topics found for this chapter yet.</p>
        </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] py-4 md:py-8">
      <header className="mb-4 px-4 md:px-8">
        <Button asChild variant="outline" size="sm" className="mb-2">
          <Link href={`/courses/${course.id}`}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to {course.title}
          </Link>
        </Button>
        <h1 className="text-base font-bold tracking-tight">{topic.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{chapter.title}</p>
      </header>

        <Tabs defaultValue="video" className="flex flex-col flex-grow">
            <TabsList className="grid w-full grid-cols-4 mx-auto max-w-xl">
                <TabsTrigger value="video"><Video className="w-4 h-4 mr-2" />Video</TabsTrigger>
                <TabsTrigger value="notes"><StickyNote className="w-4 h-4 mr-2" />Notes</TabsTrigger>
                <TabsTrigger value="syntax"><Code className="w-4 h-4 mr-2" />Syntax</TabsTrigger>
                <TabsTrigger value="practice"><BrainCircuit className="w-4 h-4 mr-2" />Practice</TabsTrigger>
            </TabsList>
            <TabsContent value="video" className="flex-grow mt-4 px-4 md:px-8">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-sm">
                            <Video className="w-5 h-5 text-primary" />
                            Lecture Video
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow flex items-center justify-center">
                        <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center max-w-3xl">
                            <p className="text-muted-foreground">Video placeholder</p>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="notes" className="flex-grow mt-4 px-4 md:px-8">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-sm">
                            <StickyNote className="w-5 h-5 text-primary" />
                            Notes
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-auto p-6">
                        <div dangerouslySetInnerHTML={{ __html: topic.notes }} className="prose dark:prose-invert max-w-none" />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="syntax" className="flex-grow mt-4">
                 <Card className="h-full flex flex-col rounded-none border-x-0">
                    <CardHeader className="px-4 md:px-8">
                        <CardTitle className="flex items-center gap-3 text-sm">
                            <Code className="w-5 h-5 text-primary" />
                            Syntax Example
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-auto p-0">
                        <div className="h-full min-h-[400px]">
                            <Compiler initialCode={topic.syntax} variant="minimal" />
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="practice" className="flex-grow mt-4">
                <Card className="h-full flex flex-col rounded-none border-x-0">
                    <CardHeader className="px-4 md:px-8">
                        <CardTitle className="flex items-center gap-3 text-sm">
                            <BrainCircuit className="w-5 h-5 text-primary" />
                            Practice
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-auto p-0">
                        <div className="h-full min-h-[400px]">
                           <Compiler initialCode={`// Try it yourself!\n// Modify the code from the previous example.\n\n${topic.syntax}`} variant="minimal" />
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
