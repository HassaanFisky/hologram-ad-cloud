import { Shell } from '../../components/Shell';

export default function DevicesPage() {
  return (
    <Shell>
      <h1>Devices</h1>
      <section className="card">
        <p className="muted">Production module screen for devices. Backend APIs are available under /api/v1.</p>
      </section>
    </Shell>
  );
}