import type { ReactNode } from 'react';

export const metadata = { title: 'HoloLED Platform Docs', description: 'Platform Documentation Site' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
