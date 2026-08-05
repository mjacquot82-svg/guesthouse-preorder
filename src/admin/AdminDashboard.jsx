import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchCloverConnection,
  getCloverConnectUrl,
} from "../services/cloverService.js";
import { useCatalogProducts } from "../stores/catalogStore.js";
import { useOwnerAuth } from "../auth/OwnerAuthContext.jsx";
import { fetchOwnerOrderSummary } from "../services/ownerOrdersApi.js";

const money = (cents, currency) => new Intl.NumberFormat("en-CA", {
  currency,
  style: "currency",
}).format(cents / 100);

export default function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useOwnerAuth();
  const [clover, setClover] = useState({ status: "loading" });
  const [orderSummary, setOrderSummary] = useState({ status: "loading" });
  const { products } = useCatalogProducts();
  const availableCount = products.filter((product) => product.available).length;

  useEffect(() => {
    fetchCloverConnection()
      .then((connection) => setClover({ status: "ready", ...connection }))
      .catch(() => setClover({ status: "error" }));
    fetchOwnerOrderSummary()
      .then((summary) => setOrderSummary({ status: "ready", ...summary }))
      .catch(() => setOrderSummary({ status: "error" }));
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/owner/login?returnTo=%2Fadmin", { replace: true });
  }

  return (
    <section className="page-section">
      <div className="page-heading">
        <h1>Admin</h1>
        <p>Keep cafe orders, menu items, and availability easy to scan.</p>
        <Link className="secondary-button" to="/admin/products">
          Manage products
        </Link>
        <Link className="secondary-button" to="/admin/scheduling">
          Manage scheduling
        </Link>
        <button className="secondary-button" type="button" onClick={handleLogout}>
          Sign out
        </button>
      </div>

      <div className="dashboard-grid">
        <Link className="metric-card metric-card-link" to="/admin/orders">
          <span>New orders</span>
          <strong>{orderSummary.status === "loading" ? "—" : orderSummary.status === "ready" ? orderSummary.new : "Unavailable"}</strong>
          <p>{orderSummary.status === "ready" ? `${orderSummary.preparing} preparing · ${orderSummary.ready} ready` : orderSummary.status === "loading" ? "Loading today’s queue…" : "Orders could not be loaded."}</p>
        </Link>
        <Link className="metric-card metric-card-link" to="/admin/orders">
          <span>Today’s paid pickups</span>
          <strong>{orderSummary.status === "loading" ? "—" : orderSummary.status === "ready" ? orderSummary.today_paid_count : "Unavailable"}</strong>
          <p>{orderSummary.status === "ready" && orderSummary.today_paid_count === 0 ? "No paid pickup revenue yet" : orderSummary.status === "ready" && orderSummary.today_paid_revenue_cents !== null && orderSummary.currency ? `${money(orderSummary.today_paid_revenue_cents, orderSummary.currency)} paid pickup revenue` : orderSummary.status === "ready" ? "Revenue unavailable across mixed currencies" : orderSummary.status === "loading" ? "Calculating from paid orders…" : "Revenue could not be loaded."}</p>
        </Link>
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
      </div>
    </section>
  );
}
