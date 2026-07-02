import type { ReactNode } from 'react';

export const metadata = { title: 'HoloLED Admin', description: 'Internal administration panel' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
