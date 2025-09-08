import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';

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
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3e%3cdefs%3e%3clinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3e%3cstop offset='0%25' style='stop-color:%23ff00a0'/%3e%3cstop offset='100%25' style='stop-color:%2300bfff'/%3e%3c/linearGradient%3e%3clinearGradient id='g2' x1='0%25' y1='50%25' x2='100%25' y2='50%25'%3e%3cstop offset='0%25' style='stop-color:%23e16dff'/%3e%3cstop offset='100%25' style='stop-color:%2389a1ff'/%3e%3c/linearGradient%3e%3c/defs%3e%3crect width='100' height='100' rx='20' ry='20' fill='black'/%3e%3crect width='92' height='92' x='4' y='4' rx='16' ry='16' fill='none' stroke='url(%23g)' stroke-width='8'/%3e%3cpath d='M25 40 l15 10 l-15 10' stroke='url(%23g2)' stroke-width='8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3e%3cpath d='M45 60 h25' stroke='url(%23g2)' stroke-width='8' fill='none' stroke-linecap='round'/%3e%3c/svg%3e" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
