import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { SettingsProvider } from '@/hooks/use-settings';
import { AuthProvider } from '@/hooks/use-auth';
import { MainLayout } from '@/layouts/main-layout';
import { CoursesProvider } from '@/hooks/use-courses';
import { GoogleDriveProvider } from '@/hooks/use-google-drive';
import Script from 'next/script';
import { CompilerFsProvider } from '@/hooks/use-compiler-fs-provider';

export const metadata: Metadata = {
  title: '24hrcoding.netlify',
  description: 'A modern JavaScript compiler powered by AI.',
  manifest: '/manifest.json',
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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FFFFFF" />
      </head>
      <body className="font-body antialiased">
        <SettingsProvider>
          <AuthProvider>
            <GoogleDriveProvider>
              <CoursesProvider>
                <CompilerFsProvider>
                  <MainLayout>
                    {children}
                  </MainLayout>
                  <Toaster />
                </CompilerFsProvider>
              </CoursesProvider>
            </GoogleDriveProvider>
          </AuthProvider>
        </SettingsProvider>
        <Script id="service-worker-registration">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                  console.log('ServiceWorker registration successful with scope: ', registration.scope);
                }, err => {
                  console.log('ServiceWorker registration failed: ', err);
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
