import Link from 'next/link';

export default function Home() {
  return (
    <main className="login card">
      <h1>HoloLED Cloud</h1>
      <p className="muted">Remote management for hologram and 3D LED advertising display networks.</p>
      <Link className="button" href="/login">Sign in</Link>
    </main>
  );
}