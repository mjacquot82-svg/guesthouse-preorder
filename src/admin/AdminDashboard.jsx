import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  fetchCloverConnection,
  getCloverConnectUrl,
  CloverConnectionError,
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
  const { logout, refreshSession } = useOwnerAuth();
  const [clover, setClover] = useState({ status: "loading" });
  const [orderSummary, setOrderSummary] = useState({ status: "loading" });
  const { products } = useCatalogProducts();
  const availableCount = products.filter((product) => product.available).length;

  const loadCloverConnection = useCallback(() => {
    setClover({ status: "loading" });
    fetchCloverConnection()
      .then((connection) => setClover({ status: "ready", ...connection }))
      .catch((error) => {
        if (!(error instanceof CloverConnectionError)) {
          setClover({ status: "server-error" });
          return;
        }
        if (error.status === 401) setClover({ status: "authentication-error" });
        else if (error.status === 403) setClover({ status: "permission-error" });
        else if (error.status === 404 || error.code === "clover_not_configured") {
          setClover({ status: "configuration-error" });
        } else if (error.code === "network_error") setClover({ status: "network-error" });
        else setClover({ status: "server-error" });
      });
  }, []);

  useEffect(() => {
    loadCloverConnection();
    fetchOwnerOrderSummary()
      .then((summary) => setOrderSummary({ status: "ready", ...summary }))
      .catch(() => setOrderSummary({ status: "error" }));
  }, [loadCloverConnection]);

  const cloverDisplay = (() => {
    if (clover.status === "loading") return {
      detail: "Determining Clover connection...",
      heading: "Checking…",
    };
    if (clover.status === "ready" && !clover.configured) return {
      detail: "Clover configuration is incomplete.",
      heading: "Configuration needed",
    };
    if (clover.status === "ready" && clover.connected) return {
      detail: [
        clover.environment ? `Environment: ${clover.environment}` : null,
        clover.merchant_id ? `Merchant: ${clover.merchant_id}` : null,
      ].filter(Boolean).join(" · ") || "Clover is ready.",
      heading: "Connected",
    };
    if (clover.status === "ready") return {
      detail: "Clover is not connected.",
      heading: "Not connected",
    };
    if (clover.status === "authentication-error") return {
      detail: "Owner session expired. Please sign in again.",
      heading: "Sign-in required",
    };
    if (clover.status === "permission-error") return {
      detail: "Your account does not have permission to view Clover settings.",
      heading: "Permission required",
    };
    if (clover.status === "configuration-error") return {
      detail: "Clover configuration is incomplete.",
      heading: "Configuration needed",
    };
    if (clover.status === "network-error") return {
      detail: "Connection to the server failed.",
      heading: "Status unavailable",
    };
    return {
      detail: "Unable to determine Clover status.",
      heading: "Status unavailable",
    };
  })();

  async function handleLogout() {
    await logout();
    navigate("/owner/login?returnTo=%2Fadmin", { replace: true });
  }

  async function handleSignInAgain() {
    try {
      await refreshSession();
      loadCloverConnection();
    } catch {
      navigate("/owner/login?returnTo=%2Fadmin", { replace: true });
    }
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
          <strong>{cloverDisplay.heading}</strong>
          <p aria-live="polite">
            {searchParams.get("clover") === "connected" && clover.connected
              ? `Authorization completed. ${cloverDisplay.detail}`
              : cloverDisplay.detail}
          </p>
          {clover.status === "ready" && !clover.connected ? (
            <a className="secondary-button" href={getCloverConnectUrl()}>
              Connect Clover
            </a>
          ) : null}
          {clover.status === "authentication-error" ? (
            <button className="secondary-button" type="button" onClick={handleSignInAgain}>
              Sign in again
            </button>
          ) : null}
          {!["loading", "ready", "authentication-error"].includes(clover.status) ? (
            <button className="secondary-button" type="button" onClick={loadCloverConnection}>
              Retry
            </button>
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
