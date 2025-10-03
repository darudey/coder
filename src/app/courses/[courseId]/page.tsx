
'use client';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import React from 'react';
import { useCourses } from '@/hooks/use-courses';
import { LoadingPage } from '@/components/loading-page';
import { Header } from '@/components/codeweave/header';

interface CoursePageProps {
  params: {
    courseId: string;
  };
}

export default function CoursePage({ params: propsParams }: CoursePageProps) {
  const params = useParams() as { courseId: string };
  const { courses, loading } = useCourses();
  const course = courses.find((c) => c.id === params.courseId);

  if (loading) {
    return <LoadingPage />;
  }

  if (!course) {
    notFound();
  }

  return (
    <>
      <Header variant="page">
        <div className="border rounded-md px-4 py-1.5 bg-muted">
            <h1 className="text-base font-bold tracking-tight">{course.title}</h1>
        </div>
      </Header>

      <div className="container mx-auto p-4 md:p-8">
        <p className="text-muted-foreground mb-8">{course.description}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {course.chapters.map((chapter) => (
            <Link href={`/courses/${course.id}/${chapter.id}`} key={chapter.id} className="group">
              <Card className="h-full hover:border-primary transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary/80"/>
                      {chapter.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm line-clamp-2">{chapter.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
         <div className="mt-8">
            <Button asChild variant="outline" size="sm">
              <Link href="/courses">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Courses
              </Link>
            </Button>
          </div>
      </div>
    </>
  );
}
