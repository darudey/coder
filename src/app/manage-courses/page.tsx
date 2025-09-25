
'use client';

import { useState } from 'react';
import { courses as initialCourses, type Course } from '@/lib/courses-data';
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

export default function ManageCoursesPage() {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  
  const [isEditCourseOpen, setIsEditCourseOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const { toast } = useToast();

  const handleDelete = (courseId: string) => {
    setCourses(prevCourses => prevCourses.filter(course => course.id !== courseId));
    toast({
        title: "Course Deleted",
        description: "The course has been removed.",
    });
  }

  const handleCreateCourse = () => {
    if (!newCourse.title || !newCourse.description) {
        toast({
            title: "Missing Information",
            description: "Please fill out both the name and description.",
            variant: "destructive",
        });
        return;
    }

    const newCourseData: Course = {
        id: nanoid(),
        title: newCourse.title,
        description: newCourse.description,
        chapters: [],
    };
    
    setCourses(prevCourses => [...prevCourses, newCourseData]);
    
    toast({
        title: "Course Created",
        description: `"${newCourse.title}" has been successfully added.`,
    });

    setNewCourse({ title: '', description: '' });
    setIsAddCourseOpen(false);
  }

  const handleOpenEditDialog = (course: Course) => {
    setEditingCourse(course);
    setIsEditCourseOpen(true);
  }

  const handleUpdateCourse = () => {
    if (!editingCourse) return;

    if (!editingCourse.title || !editingCourse.description) {
        toast({
            title: "Missing Information",
            description: "Name and description cannot be empty.",
            variant: "destructive",
        });
        return;
    }

    setCourses(prevCourses => 
        prevCourses.map(course => 
            course.id === editingCourse.id ? editingCourse : course
        )
    );

    toast({
        title: "Course Updated",
        description: `"${editingCourse.title}" has been successfully updated.`,
    });

    setEditingCourse(null);
    setIsEditCourseOpen(false);
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
        <Dialog open={isAddCourseOpen} onOpenChange={setIsAddCourseOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Course
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Course</DialogTitle>
                    <DialogDescription>
                        Fill in the details for your new course below.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="course-name" className="text-right">Name</Label>
                        <Input
                            id="course-name"
                            value={newCourse.title}
                            onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                            className="col-span-3"
                            placeholder="e.g., Advanced JavaScript"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="course-description" className="text-right">Description</Label>
                        <Textarea
                            id="course-description"
                            value={newCourse.description}
                            onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                            className="col-span-3"
                            placeholder="A brief summary of the course content."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleCreateCourse}>Create Course</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
                    <Button variant="outline" size="sm" className="w-full" onClick={() => handleOpenEditDialog(course)}>
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

       {editingCourse && (
        <Dialog open={isEditCourseOpen} onOpenChange={setIsEditCourseOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Course</DialogTitle>
                    <DialogDescription>
                        Update the details for your course below.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-course-name" className="text-right">Name</Label>
                        <Input
                            id="edit-course-name"
                            value={editingCourse.title}
                            onChange={(e) => setEditingCourse({ ...editingCourse, title: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-course-description" className="text-right">Description</Label>
                        <Textarea
                            id="edit-course-description"
                            value={editingCourse.description}
                            onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" onClick={() => setIsEditCourseOpen(false)}>Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleUpdateCourse}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
