
'use client';

import { type Chapter } from '@/lib/courses-data';
import Link from 'next/link';
import { notFound, useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, ChevronLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React, { useState, useEffect } from 'react';
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
import { useCourses } from '@/hooks/use-courses';
import { LoadingPage } from '@/components/loading-page';
import { Header } from '@/components/codeweave/header';


interface ManageChapterPageProps {
  params: {
    courseId: string;
  };
}

export default function ManageChapterPage({ params: propsParams }: ManageChapterPageProps) {
  const params = useParams() as { courseId: string };
  const router = useRouter();
  const { toast } = useToast();
  const { courses, addChapter, updateChapter, deleteChapter, loading } = useCourses();

  const course = courses.find((c) => c.id === params.courseId);

  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [newChapter, setNewChapter] = useState({ title: '', description: '' });

  const [isEditChapterOpen, setIsEditChapterOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);

  if (loading) {
    return <LoadingPage />;
  }

  if (!course) {
    notFound();
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

    addChapter(course.id, newChapter.title, newChapter.description);
    
    toast({
        title: "Chapter Created",
        description: `"${newChapter.title}" has been successfully added.`,
    });

    setNewChapter({ title: '', description: '' });
    setIsAddChapterOpen(false);
  }

  const handleOpenEditDialog = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setIsEditChapterOpen(true);
  }

  const handleUpdateChapter = () => {
    if (!editingChapter) return;

    if (!editingChapter.title || !editingChapter.description) {
        toast({
            title: "Missing Information",
            description: "Title and description cannot be empty.",
            variant: "destructive",
        });
        return;
    }

    updateChapter(course.id, editingChapter.id, editingChapter);

    toast({
        title: "Chapter Updated",
        description: `"${editingChapter.title}" has been successfully updated.`,
    });

    setEditingChapter(null);
    setIsEditChapterOpen(false);
  }

  const handleDeleteChapter = (chapterId: string) => {
    deleteChapter(course.id, chapterId);
    toast({
      title: "Chapter Deleted",
      description: "The chapter has been removed from the course.",
    });
  }


  return (
    <>
      <Header variant="page">
        <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-4">
                <Button asChild variant="outline" size="sm">
                <Link href="/manage-courses">
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back to Courses
                </Link>
                </Button>
                <div className="border rounded-md px-4 py-1.5 bg-muted min-w-0">
                    <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight truncate">Manage: {course.title}</h1>
                </div>
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
        </div>
      </Header>
      <div className="container mx-auto p-4 md:p-8">
        <p className="text-muted-foreground mt-4 mb-8">{course.description}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {course.chapters.map((chapter) => (
            <Card key={chapter.id} className="h-full flex flex-col">
              <Link href={`/manage-courses/${course.id}/${chapter.id}`} className="flex-grow group">
                <CardHeader className="flex-grow group-hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary/80"/>
                      {chapter.title}
                  </CardTitle>
                  <p className="text-muted-foreground text-sm font-normal pt-2 line-clamp-2">{chapter.description}</p>
                </CardHeader>
              </Link>
              <CardContent>
                 <div className="flex gap-2 mt-4">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => handleOpenEditDialog(chapter)}>
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
                                    This action cannot be undone. This will permanently delete this chapter.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteChapter(chapter.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      {editingChapter && (
        <Dialog open={isEditChapterOpen} onOpenChange={setIsEditChapterOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Chapter</DialogTitle>
                    <DialogDescription>
                        Update the details for your chapter below.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-chapter-title" className="text-right">Title</Label>
                        <Input
                            id="edit-chapter-title"
                            value={editingChapter.title}
                            onChange={(e) => setEditingChapter({ ...editingChapter, title: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-chapter-description" className="text-right">Description</Label>
                        <Textarea
                            id="edit-chapter-description"
                            value={editingChapter.description}
                            onChange={(e) => setEditingChapter({ ...editingChapter, description: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" onClick={() => setIsEditChapterOpen(false)}>Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleUpdateChapter}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </>
  );
}
