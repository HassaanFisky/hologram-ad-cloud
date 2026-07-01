import { Shell } from '../../components/Shell';

export default function Dashboard() {
  return (
    <Shell>
      <h1>Operations Overview</h1>
      <div className="grid">
        <div className="card">
          <div className="muted">Online Devices</div>
          <div className="metric">--</div>
        </div>
        <div className="card">
          <div className="muted">Active Schedules</div>
          <div className="metric">--</div>
        </div>
        <div className="card">
          <div className="muted">Media Assets</div>
          <div className="metric">--</div>
        </div>
        <div className="card">
          <div className="muted">Customers</div>
          <div className="metric">--</div>
        </div>
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>Network Health</h2>
        <p className="muted">Connect company context after login profile endpoint is enabled for tenant-scoped analytics.</p>
      </section>
    </Shell>
  );
}
