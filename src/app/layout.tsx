import './globals.css';
import type {ReactNode} from 'react';
import type {Viewport} from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({children}:{children:ReactNode}){
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
