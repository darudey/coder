
'use client';

import { useCourses } from '@/hooks/use-courses';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { LoadingPage } from '@/components/loading-page';
import { Header } from '@/components/codeweave/header';

export default function CoursesPage() {
  const { courses, loading } = useCourses();
  
  if (loading) {
    return <LoadingPage />;
  }

  return (
    <>
      <Header variant="page">
        <div className="border rounded-md px-4 py-1.5 bg-muted min-w-0">
            <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight truncate">Courses</h1>
        </div>
      </Header>
      <div className="container mx-auto p-4 md:p-8">
        <p className="text-muted-foreground mt-4 mb-8">
          Start your journey into web development. Choose a course to begin.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Link href={`/courses/${course.id}`} key={course.id} className="group active:bg-primary/20 rounded-lg">
              <Card className="h-full group-hover:border-primary transition-colors">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-md">
                      <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>{course.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{course.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
