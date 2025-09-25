
'use client';

import { courses as initialCourses, type Course, type Chapter } from '@/lib/courses-data';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ChevronLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';


interface ManageChapterPageProps {
  params: {
    courseId: string;
  };
}

export default function ManageChapterPage({ params: paramsProp }: ManageChapterPageProps) {
  const params = React.use(paramsProp);
  const router = useRouter();
  const { toast } = useToast();

  // Since we can't easily pass state between pages without a global manager,
  // we'll fetch the course from the initial data and manage its state locally.
  const [course, setCourse] = useState<Course | undefined>(() => 
    initialCourses.find((c) => c.id === params.courseId)
  );

  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [newChapter, setNewChapter] = useState({ title: '', description: '' });

  if (!course) {
    // This will be caught by the notFound() in server components,
    // but good practice to handle in client too.
    useEffect(() => {
      notFound();
    }, []);
    return null;
  }
  
  const handleCreateChapter = () => {
    if (!newChapter.title || !newChapter.description) {
        toast({
            title: "Missing Information",
            description: "Please fill out both the title and description.",
            variant: "destructive",
        });
        return;
    }

    const newChapterData: Chapter = {
        id: nanoid(),
        title: newChapter.title,
        description: newChapter.description,
        topics: [],
    };
    
    setCourse(prevCourse => {
        if (!prevCourse) return prevCourse;
        const updatedCourse = {
            ...prevCourse,
            chapters: [...prevCourse.chapters, newChapterData]
        };
        // Note: This only updates local state. To persist, we'd need to update the source.
        return updatedCourse;
    });
    
    toast({
        title: "Chapter Created",
        description: `"${newChapter.title}" has been successfully added.`,
    });

    setNewChapter({ title: '', description: '' });
    setIsAddChapterOpen(false);
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
        <Dialog open={isAddChapterOpen} onOpenChange={setIsAddChapterOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Chapter
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Chapter</DialogTitle>
                    <DialogDescription>
                        Fill in the details for your new chapter below.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="chapter-title" className="text-right">Title</Label>
                        <Input
                            id="chapter-title"
                            value={newChapter.title}
                            onChange={(e) => setNewChapter({ ...newChapter, title: e.target.value })}
                            className="col-span-3"
                            placeholder="e.g., Introduction to Functions"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="chapter-description" className="text-right">Description</Label>
                        <Textarea
                            id="chapter-description"
                            value={newChapter.description}
                            onChange={(e) => setNewChapter({ ...newChapter, description: e.target.value })}
                            className="col-span-3"
                            placeholder="What will users learn in this chapter?"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleCreateChapter}>Create Chapter</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
