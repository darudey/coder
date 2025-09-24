
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';

export default function ProfilePage() {
  return (
    <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
            <Avatar className="w-24 h-24 mb-4">
                <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                <AvatarFallback>
                    <User className="w-12 h-12" />
                </AvatarFallback>
            </Avatar>
            <CardTitle className="text-3xl font-bold">User Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Your profile page is coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
