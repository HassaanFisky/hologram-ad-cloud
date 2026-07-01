import { Shell } from '../../components/Shell';

export default function AdminPage() {
  return (
    <Shell>
      <h1>Admin</h1>
      <section className="card">
        <p className="muted">Production module screen for admin. Backend APIs are available under /api/v1.</p>
      </section>
    </Shell>
  );
}
