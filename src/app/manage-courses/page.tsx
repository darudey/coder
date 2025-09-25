
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit3 } from 'lucide-react';

export default function ManageCoursesPage() {
  return (
    <div className="container mx-auto p-4 md:p-8">
        <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Manage Courses</h1>
            <p className="text-muted-foreground mt-2 text-sm">
            Create, edit, and manage your interactive courses here.
            </p>
        </header>
        <Card className="flex flex-col items-center justify-center min-h-[400px]">
            <CardHeader className="text-center items-center">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                    <Edit3 className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl font-bold">Course Management Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-center max-w-md">
                    This is where you'll be able to build and organize your courses. We'll add tools to manage chapters, topics, notes, and practice questions.
                </p>
            </CardContent>
        </Card>
    </div>
  );
}
