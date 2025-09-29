
'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingPage } from '@/components/loading-page';

type Role = 'student' | 'teacher' | 'developer';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return; // Wait until authentication status is resolved
    }

    if (!user) {
      // If not logged in, redirect to profile to sign in
      router.push('/profile');
      return;
    }

    if (!userRole || !allowedRoles.includes(userRole)) {
      // If role is not allowed, redirect to access denied
      router.push('/access-denied');
    }
  }, [user, userRole, loading, router, allowedRoles]);

  if (loading || !user || !userRole || !allowedRoles.includes(userRole)) {
    // Show a loading page while checking auth or during redirection
    return <LoadingPage />;
  }

  return <>{children}</>;
}
