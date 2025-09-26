
import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { SettingsProvider } from '@/hooks/use-settings';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Home, Book, BrainCircuit, User, Menu, Edit3 } from 'lucide-react';
import Link from 'next/link';
import { CoursesProvider } from '@/hooks/use-courses';

export const metadata: Metadata = {
  title: '24HrCoding',
  description: 'A modern JavaScript compiler powered by AI.',
};

const navItems = [
  { href: '/', label: 'Compiler', icon: Home },
  { href: '/courses', label: 'Courses', icon: Book },
  { href: '/practice', label: 'Practice', icon: BrainCircuit },
  { href: '/manage-courses', label: 'Manage Courses', icon: Edit3 },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <SettingsProvider>
          <CoursesProvider>
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
            <Toaster />
          </CoursesProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
