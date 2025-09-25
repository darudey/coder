
'use client';

import { courses } from '@/lib/courses-data';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function ManageCoursesPage() {
  const handleDelete = (courseId: string) => {
    // Placeholder for delete logic
    console.log("Deleting course:", courseId);
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Manage Courses</h1>
            <p className="text-muted-foreground mt-2 text-sm">
            Create, edit, and manage your interactive courses here.
            </p>
        </div>
        <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add New Course
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <Card key={course.id} className="h-full flex flex-col">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-md">
                    <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>{course.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col">
                <p className="text-muted-foreground text-xs flex-grow">{course.description}</p>
                <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="w-full">
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="w-full">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the course and all of its chapters and topics.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(course.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
              </CardContent>
            </Card>
        ))}
      </div>
    </div>
  );
}
