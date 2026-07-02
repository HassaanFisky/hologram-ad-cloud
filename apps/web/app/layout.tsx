import './globals.css';
import type { ReactNode } from 'react';

export const metadata = { title: 'HoloLED Cloud', description: 'Commercial hologram and 3D LED display management platform' };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}