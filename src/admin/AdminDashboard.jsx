const metrics = [
  { label: "Open orders", value: "0", note: "Awaiting live queue" },
  { label: "Menu items", value: "0", note: "Ready for catalog sync" },
  { label: "Today revenue", value: "$0", note: "Pending payment integration" },
];

export default function AdminDashboard() {
  return (
    <section className="page-section">
      <div className="page-heading">
        <h1>Admin</h1>
        <p>Keep room orders, menu items, and availability easy to scan.</p>
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
