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
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='a' x1='0' y1='0' x2='100' y2='100'><stop offset='0' stop-color='%23ff007f'/><stop offset='1' stop-color='%23007fff'/></linearGradient></defs><rect width='100' height='100' rx='20' fill='black'/><rect width='92' height='92' x='4' y='4' rx='16' fill='none' stroke='url(%23a)' stroke-width='8'/><path d='M30 40 L45 50 L30 60' fill='none' stroke='url(%23a)' stroke-width='8' stroke-linecap='round' stroke-linejoin='round'/><path d='M55 60 H 75' fill='none' stroke='url(%23a)' stroke-width='8' stroke-linecap='round'/></svg>" />
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
