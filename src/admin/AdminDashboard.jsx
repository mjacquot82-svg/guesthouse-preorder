import { Link } from "react-router-dom";
import { useCatalogProducts } from "../stores/catalogStore.js";

const metrics = [
  { label: "Open orders", value: "0", note: "Awaiting live queue" },
  { label: "Today revenue", value: "$0", note: "Pending payment integration" },
];

export default function AdminDashboard() {
  const { products } = useCatalogProducts();
  const availableCount = products.filter((product) => product.available).length;

  return (
    <section className="page-section">
      <div className="page-heading">
        <h1>Admin</h1>
        <p>Keep cafe orders, menu items, and availability easy to scan.</p>
        <Link className="secondary-button" to="/admin/products">
          Manage products
        </Link>
      </div>

      <div className="dashboard-grid">
        <article className="metric-card">
          <span>Menu items</span>
          <strong>{products.length}</strong>
          <p>{availableCount} currently available</p>
        </article>
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
