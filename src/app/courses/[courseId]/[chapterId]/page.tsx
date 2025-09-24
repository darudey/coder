
import { courses } from '@/lib/courses-data';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Video, StickyNote, Code, BrainCircuit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Compiler } from '@/components/codeweave/compiler';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

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

  // Find the topic to display. For now, we'll just display the first topic of the chapter.
  const topic = chapter.topics[0];

  if (!topic) {
    return (
        <div className="container mx-auto p-4 md:p-8">
            <p>No topics found for this chapter yet.</p>
        </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-8 flex flex-col h-[calc(100vh-4rem)]">
      <header className="mb-4">
        <Button asChild variant="outline" size="sm" className="mb-2">
          <Link href={`/courses/${course.id}`}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to {course.title}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{topic.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{chapter.title}</p>
      </header>

      <Carousel className="w-full flex-grow">
        <CarouselContent className="h-full">
          <CarouselItem className="h-full">
            <div className="p-1 h-full">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
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
            </div>
          </CarouselItem>
          <CarouselItem className="h-full">
             <div className="p-1 h-full">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <StickyNote className="w-5 h-5 text-primary" />
                            Notes
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-auto">
                        <div dangerouslySetInnerHTML={{ __html: topic.notes }} className="prose dark:prose-invert max-w-none" />
                    </CardContent>
                </Card>
            </div>
          </CarouselItem>
          <CarouselItem className="h-full">
            <div className="p-1 h-full">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <Code className="w-5 h-5 text-primary" />
                            Syntax Example
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-auto">
                        <div className="h-full min-h-[400px]">
                            <Compiler initialCode={topic.syntax} />
                        </div>
                    </CardContent>
                </Card>
            </div>
          </CarouselItem>
           <CarouselItem className="h-full">
            <div className="p-1 h-full">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <BrainCircuit className="w-5 h-5 text-primary" />
                            Practice
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-auto">
                       <div className="h-full min-h-[400px]">
                            <Compiler initialCode={`// Try it yourself!\n// Modify the code from the previous example.\n\n${topic.syntax}`} />
                        </div>
                    </CardContent>
                </Card>
            </div>
          </CarouselItem>
        </CarouselContent>
        <CarouselPrevious className="ml-12" />
        <CarouselNext className="mr-12" />
      </Carousel>
    </div>
  );
}
