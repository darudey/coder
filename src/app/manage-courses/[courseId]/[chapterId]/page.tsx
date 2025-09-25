
'use client';

import { courses } from '@/lib/courses-data';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import React from 'react';

interface ManageTopicPageProps {
  params: {
    courseId: string;
    chapterId: string;
  };
}

export default function ManageTopicPage({ params: paramsProp }: ManageTopicPageProps) {
  const params = React.use(paramsProp);
  const course = courses.find((c) => c.id === params.courseId);
  const chapter = course?.chapters.find((ch) => ch.id === params.chapterId);

  if (!course || !chapter) {
    notFound();
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <Button asChild variant="outline" size="sm" className="mb-4">
          <Link href={`/manage-courses/${course.id}`}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to {course.title}
          </Link>
        </Button>
        <h1 className="text-lg font-bold tracking-tight">Manage Topics for: {chapter.title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">Add, edit, and reorder the topics for this chapter.</p>
      </header>
      
      <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">Topic editor coming soon!</p>
      </div>
    </div>
  );
}
