
import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { SettingsProvider } from '@/hooks/use-settings';
import { AuthProvider } from '@/hooks/use-auth';
import { MainLayout } from '@/layouts/main-layout';
import { CoursesProvider } from '@/hooks/use-courses';

export const metadata: Metadata = {
  title: '24HrCoding',
  description: 'A modern JavaScript compiler powered by AI.',
};

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
          <AuthProvider>
            <CoursesProvider>
              <MainLayout>
                {children}
              </MainLayout>
              <Toaster />
            </CoursesProvider>
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
