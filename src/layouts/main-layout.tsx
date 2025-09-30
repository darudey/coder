
'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Home, Book, User, Menu, Edit3, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';

const defaultNavItems = [
  { href: '/', label: 'Compiler', icon: Home },
  { href: '/courses', label: 'Courses', icon: Book },
  { href: '/profile', label: 'Profile', icon: User },
];

const adminNavItems = [
    { href: '/manage-courses', label: 'Manage Courses', icon: Edit3, roles: ['teacher', 'developer'] },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
    const { userRole } = useAuth();
    
    const navItems = [
        ...defaultNavItems,
        ...adminNavItems.filter(item => item.roles.includes(userRole || ''))
    ]

    return (
        <div className="relative min-h-screen">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="fixed top-4 left-4 z-50 bg-background/50 backdrop-blur-sm">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <SheetHeader>
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col space-y-2 pt-8">
                {navItems.map(item => (
                  <Button variant="ghost" asChild key={item.label} className="justify-start">
                    <Link href={item.href}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </Link>
                  </Button>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          
          <main>
              {children}
          </main>
        </div>
    )
}
