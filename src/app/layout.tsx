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

const faviconHref = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KICAgIDxkZWZzPgogICAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNmZjAwYTAiLz4KICAgICAgICA8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMGJmZmYiLz4KICAgICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDwvZGVmcz4KCiAgICA8cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiByeT0iMjAiIGZpbGw9InVybCgjZykiIC8+CgogICAgPCEtLSBDbGVhbiwgbm9uLWJsb2F0ZWQgYXJyb3cgLS0+CiAgICA8cGF0aAogICAgICBkPSJNMjIgMzUgTDQ1IDUwIEwyMiA2NSIKICAgICAgc3Ryb2tlPSJ3aGl0ZSIKICAgICAgc3Ryb2tlLXdpZHRoPSIxMCIKICAgICAgZmlsbD0ibm9uZSIKICAgICAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogICAgICBzdHJva2UtbGluZWpvaW49InJvdW5kIgogICAgLz4KCiAgICA8IS0tIEJhbGFuY2VkIGhvcml6b250YWwgbGluZSAtLT4KICAgIDxwYXRoCiAgICAgIGQ9Ik00OCA2MiBINDgwIgogICAgICBzdHJva2U9IndoaXRlIgogICAgICBzdHJva2Utd2lkdGg9IjEwIgogICAgICBmaWxsPSJub25lIgogICAgICBzdHJva2UtbGluZWNhcD0icm91bmQiCiAgICAvPgo8L3N2Zz4=";

export default function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: { id?: string };
}>) {
  // Check if we are on a share page to pass initialCode
  const initialCode = (children as any)?.props?.childProp?.segment === 's' ? (children as any).props.childProp.initialCode : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href={faviconHref} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={faviconHref} />
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
                <CompilerFsProvider initialCode={initialCode}>
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
