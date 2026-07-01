import Link from 'next/link';
import type { ReactNode } from 'react';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">HoloLED Cloud</div>
        <nav className="nav">
          <Link href="/dashboard">Overview</Link>
          <Link href="/devices">Devices</Link>
          <Link href="/media">Media</Link>
          <Link href="/schedules">Schedules</Link>
          <Link href="/customers">Customers</Link>
          <Link href="/admin">Admin</Link>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
