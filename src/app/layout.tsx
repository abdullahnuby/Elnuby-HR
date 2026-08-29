import './globals.css';
import type {ReactNode} from 'react';
import type {Viewport, Metadata} from 'next';

export const metadata: Metadata = {
  title: 'ELNUBY HR Workforce',
  description: 'نظام إدارة الموارد البشرية والقوى العاملة بالمشروعات',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({children}:{children:ReactNode}){
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
