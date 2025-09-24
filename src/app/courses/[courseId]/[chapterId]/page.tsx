
import { courses } from '@/lib/courses-data';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Video, StickyNote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CourseCodeEditor } from '@/components/codeweave/course-code-editor';

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
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <Button asChild variant="outline" size="sm" className="mb-4">
          <Link href={`/courses/${course.id}`}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to {course.title}
          </Link>
        </Button>
        <h1 className="text-4xl font-bold tracking-tight">{topic.title}</h1>
        <p className="text-muted-foreground mt-2">{chapter.title}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <Video className="w-5 h-5 text-primary" />
                        Lecture Video
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                        <p className="text-muted-foreground">Video placeholder</p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <StickyNote className="w-5 h-5 text-primary" />
                        Notes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-64 rounded-md border p-4">
                       <div dangerouslySetInnerHTML={{ __html: topic.notes }} className="prose dark:prose-invert max-w-none" />
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
        <div className="h-[calc(100vh-12rem)] min-h-[400px]">
            <h3 className="text-xl font-semibold mb-4">Syntax Example</h3>
            <CourseCodeEditor initialCode={topic.syntax} />
        </div>
      </div>
    </div>
  );
}
