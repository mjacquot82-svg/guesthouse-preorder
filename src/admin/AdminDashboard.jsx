import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchCloverConnection,
  getCloverConnectUrl,
} from "../services/cloverService.js";
import { useCatalogProducts } from "../stores/catalogStore.js";

const metrics = [
  { label: "Open orders", value: "0", note: "Awaiting live queue" },
  { label: "Today revenue", value: "$0", note: "Pending payment integration" },
];

export default function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const [clover, setClover] = useState({ status: "loading" });
  const { products } = useCatalogProducts();
  const availableCount = products.filter((product) => product.available).length;

  useEffect(() => {
    fetchCloverConnection()
      .then((connection) => setClover({ status: "ready", ...connection }))
      .catch(() => setClover({ status: "error" }));
  }, []);

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
          <span>Clover</span>
          <strong>
            {clover.connected ? "Connected" : clover.status === "loading" ? "Checking…" : "Not connected"}
          </strong>
          <p>
            {searchParams.get("clover") === "connected"
              ? "Authorization completed."
              : "Authorize REST and Hosted Checkout access."}
          </p>
          {!clover.connected ? (
            <a className="secondary-button" href={getCloverConnectUrl()}>
              Connect Clover
            </a>
          ) : null}
        </article>
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
