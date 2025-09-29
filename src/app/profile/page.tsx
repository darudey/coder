
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfilePage() {
    const { user, userRole, loading, signInWithGoogle, signOut } = useAuth();

    if (loading) {
        return (
            <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
                <Card className="w-full max-w-md">
                    <CardHeader className="items-center text-center">
                        <Skeleton className="w-24 h-24 rounded-full mb-4" />
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Skeleton className="h-10 w-28" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!user) {
        return (
             <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
                <Card className="w-full max-w-md text-center">
                    <CardHeader className="items-center">
                        <Avatar className="w-24 h-24 mb-4">
                             <AvatarFallback>
                                <User className="w-12 h-12" />
                            </AvatarFallback>
                        </Avatar>
                        <CardTitle className="text-2xl font-bold">Welcome!</CardTitle>
                         <CardDescription>
                            Sign in to access your profile and courses.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={signInWithGoogle}>
                            <LogIn className="mr-2 h-4 w-4" /> Sign in with Google
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

  return (
    <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
            <Avatar className="w-24 h-24 mb-4">
                <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} />
                <AvatarFallback>
                    <User className="w-12 h-12" />
                </AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl font-bold">{user.displayName}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
            {userRole && <Badge variant="secondary" className="mt-2">{userRole}</Badge>}
        </CardHeader>
        <CardContent>
            <Button onClick={signOut} variant="outline">
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
