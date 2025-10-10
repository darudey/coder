
'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative min-h-screen">
          <main>
              {children}
          </main>
          <FirebaseErrorListener />
        </div>
    )
}
