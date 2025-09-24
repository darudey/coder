
import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { SettingsProvider } from '@/hooks/use-settings';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Home, Book, BrainCircuit, User, Menu } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '24HrCoding',
  description: 'A modern JavaScript compiler powered by AI.',
};

const navItems = [
  { href: '/', label: 'Compiler', icon: Home },
  { href: '/courses', label: 'Courses', icon: Book },
  { href: '/practice', label: 'Practice', icon: BrainCircuit },
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
        <link rel="icon" href="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3e%3cdefs%3e%3clinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3e%3cstop offset='0%25' style='stop-color:%23ff00a0'/%3e%3cstop offset='100%25' style='stop-color:%2300bfff'/%3e%3c/linearGradient%3e%3c/defs%3e%3crect width='100' height='100' rx='20' ry='20' fill='url(%23g)'/%3e%3cpath d='M25 40 l15 10 l-15 10' stroke='white' stroke-width='8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3e%3cpath d='M45 60 h25' stroke='white' stroke-width='8' fill='none' stroke-linecap='round'/%3e%3c/svg%3e" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <SettingsProvider>
          <div className="relative min-h-screen">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="fixed top-4 left-4 z-50 bg-background/50 backdrop-blur-sm">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
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
        </SettingsProvider>
      </body>
    </html>
  );
}
