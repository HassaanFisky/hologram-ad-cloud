import { Shell } from '../../components/Shell';

export default function CustomersPage() {
  return (
    <Shell>
      <h1>Customers</h1>
      <section className="card">
        <p className="muted">Production module screen for customers. Backend APIs are available under /api/v1.</p>
      </section>
    </Shell>
  );
}