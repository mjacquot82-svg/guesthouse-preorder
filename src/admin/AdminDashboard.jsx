const metrics = [
  { label: "Open orders", value: "0", note: "Awaiting live queue" },
  { label: "Menu items", value: "0", note: "Ready for catalog sync" },
  { label: "Today revenue", value: "$0", note: "Pending payment integration" },
];

export default function AdminDashboard() {
  return (
    <section className="page-section">
      <div className="page-heading">
        <p className="eyebrow">Admin</p>
        <h1>Operations dashboard</h1>
        <p>Monitor preorder activity, product readiness, and guest service flow.</p>
      </div>

      <div className="dashboard-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
