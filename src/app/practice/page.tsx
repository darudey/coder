
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PracticePage() {
  return (
    <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Practice</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This is where you'll find practice exercises. This section is under construction.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
