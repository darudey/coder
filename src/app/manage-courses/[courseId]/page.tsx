
'use client';

import { courses } from '@/lib/courses-data';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ChevronLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React from 'react';

interface ManageChapterPageProps {
  params: {
    courseId: string;
  };
}

export default function ManageChapterPage({ params: paramsProp }: ManageChapterPageProps) {
  const params = React.use(paramsProp);
  const course = courses.find((c) => c.id === params.courseId);

  if (!course) {
    notFound();
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
            <Button asChild variant="outline" size="sm" className="mb-4">
            <Link href="/manage-courses">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Courses
            </Link>
            </Button>
            <h1 className="text-lg font-bold tracking-tight">Manage Chapters for: {course.title}</h1>
            <p className="text-muted-foreground mt-2 text-sm">{course.description}</p>
        </div>
        <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add New Chapter
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {course.chapters.map((chapter) => (
          <Card key={chapter.id} className="h-full flex flex-col">
            <CardHeader className="flex-grow">
              <CardTitle className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary/80"/>
                  {chapter.title}
              </CardTitle>
               <p className="text-muted-foreground text-sm font-normal pt-2 line-clamp-2">{chapter.description}</p>
            </CardHeader>
            <CardContent>
               <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="w-full">
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                    </Button>
                    <Button variant="destructive" size="sm" className="w-full">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                    </Button>
                </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
