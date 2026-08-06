import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShoppingBag } from "lucide-react";
import { useOwnerAuth } from "../auth/OwnerAuthContext.jsx";
import {
  fetchActiveOwnerOrders,
  fetchOwnerOrderHistory,
  updateOwnerOrderFulfillment,
} from "../services/ownerOrdersApi.js";
import { pickupTiming, summarizeOwnerOrders } from "../services/ownerOrderPresentation.js";

const money = (cents, currency = "CAD") => new Intl.NumberFormat("en-CA", {
  currency,
  style: "currency",
}).format(cents / 100);

const STATUS_LABELS = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready for pickup",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PAYMENT_LABELS = {
  pending: "Checkout not started",
  payment_pending: "Waiting for payment",
  paid: "Paid",
  payment_failed: "Payment failed",
};

const NEXT_ACTION = {
  new: ["Start Preparing", "preparing"],
  preparing: ["Mark Ready", "ready"],
  ready: ["Complete Order", "completed"],
};

function pickupTime(order) {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: order.business_timezone,
  }).format(new Date(order.requested_pickup_at));
}

function operationalTime(value, timezone) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function itemSummary(order) {
  return order.items.slice(0, 2).map((item) => `${item.quantity} × ${item.product_name}`).join(", ")
    + (order.items.length > 2 ? ` + ${order.items.length - 2} more` : "");
}

function OrderDetail({ order }) {
  return (
    <div className="owner-order-detail">
      <div className="owner-order-customer">
        <div><span>Customer</span><strong>{order.customer_name}</strong></div>
        <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>
        <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a>
      </div>
      {order.notes ? <div className="owner-order-note"><strong>Order note</strong><p>{order.notes}</p></div> : null}
      <div className="owner-order-lines">
        {order.items.map((item, index) => (
          <div className="owner-order-line" key={`${item.product_slug}-${index}`}>
            <strong>{item.quantity} × {item.product_name}</strong>
            <span>{item.variant_name || "Standard"}</span>
            {item.modifiers.map((modifier) => (
              <small key={`${modifier.group_key}-${modifier.option_key}`}>{modifier.group_name}: {modifier.option_name}</small>
            ))}
            <b>{money(item.line_subtotal_cents, order.currency)}</b>
          </div>
        ))}
      </div>
      <dl className="owner-order-totals">
        <div><dt>Subtotal</dt><dd>{money(order.subtotal_cents, order.currency)}</dd></div>
        <div><dt>{order.tax_name}</dt><dd>{money(order.tax_cents, order.currency)}</dd></div>
        <div><dt>Total</dt><dd>{money(order.total_cents, order.currency)}</dd></div>
      </dl>
      <div className="owner-order-timeline" aria-label="Order progress">
        <span>Received {operationalTime(order.created_at, order.business_timezone)}</span>
        {order.fulfillment_timestamps.preparing_at ? <span>Preparing {operationalTime(order.fulfillment_timestamps.preparing_at, order.business_timezone)}</span> : null}
        {order.fulfillment_timestamps.ready_at ? <span>Ready {operationalTime(order.fulfillment_timestamps.ready_at, order.business_timezone)}</span> : null}
        {order.fulfillment_timestamps.completed_at ? <span>Completed {operationalTime(order.fulfillment_timestamps.completed_at, order.business_timezone)}</span> : null}
        {order.fulfillment_timestamps.cancelled_at ? <span>Cancelled {operationalTime(order.fulfillment_timestamps.cancelled_at, order.business_timezone)}</span> : null}
      </div>
      <p className="owner-order-created">Received {new Date(order.created_at).toLocaleString("en-CA")}</p>
    </div>
  );
}

function OrderCard({ busy, now, onAction, onCancel, order }) {
  const [expanded, setExpanded] = useState(false);
  const next = NEXT_ACTION[order.fulfillment_status];
  const actionable = order.payment_status === "paid" && next;
  const overdue = new Date(order.requested_pickup_at) < now;
  return (
    <article className={`owner-order-card status-${order.fulfillment_status} ${overdue ? "is-overdue" : ""}`}>
      <div className="owner-order-card-top">
        <div>
          <p className="owner-order-reference">{order.reference}</p>
          <h2>{order.customer_name}</h2>
          <p>{itemSummary(order)}</p>
        </div>
        <div className="owner-pickup-time">
          <span>Pickup</span><strong>{pickupTime(order)}</strong>
          <b className={overdue ? "overdue" : ""}>{pickupTiming(order, now)}</b>
        </div>
      </div>
      <div className="owner-order-badges">
        <span className={`order-badge fulfillment-${order.fulfillment_status}`}>{STATUS_LABELS[order.fulfillment_status]}</span>
        <span className={`order-badge payment-${order.payment_status}`}>{PAYMENT_LABELS[order.payment_status]}</span>
        <span>{order.item_count} item{order.item_count === 1 ? "" : "s"}</span>
        <strong>{money(order.total_cents, order.currency)}</strong>
      </div>
      {order.payment_status !== "paid" ? (
        <p className="owner-order-warning"><AlertTriangle size={17} /> Do not prepare—payment is not complete.</p>
      ) : null}
      {expanded ? <OrderDetail order={order} /> : null}
      <div className="owner-order-actions">
        <button className="secondary-button" type="button" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide Details" : "View Details"}
        </button>
        {actionable ? (
          <button className="primary-button" disabled={busy} type="button" onClick={() => onAction(order, next[1])}>
            {busy ? "Updating…" : next[0]}
          </button>
        ) : null}
        {order.payment_status === "paid" && !["completed", "cancelled"].includes(order.fulfillment_status) ? (
          <button className="owner-cancel-button" disabled={busy} type="button" onClick={() => onCancel(order)}>Cancel Order</button>
        ) : null}
      </div>
    </article>
  );
}

function CancelDialog({ busy, onCancel, onClose, order }) {
  const dialog = useRef(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog aria-labelledby="cancel-order-title" className="owner-confirm-dialog" onCancel={onClose} ref={dialog}>
      <h2 id="cancel-order-title">Cancel {order.reference}?</h2>
      <p>This removes the order from the active café queue. It does not issue a Clover refund.</p>
      <div className="form-actions">
        <button className="owner-danger-button" disabled={busy} type="button" onClick={onCancel}>{busy ? "Cancelling…" : "Cancel Order"}</button>
        <button className="secondary-button" disabled={busy} type="button" onClick={onClose}>Keep Order</button>
      </div>
    </dialog>
  );
}

export default function OrdersPage() {
  const { session } = useOwnerAuth();
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState("active");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [cancelOrder, setCancelOrder] = useState(null);
  const knownIds = useRef(new Set());
  const busyRef = useRef(false);

  const refresh = useCallback(async ({ initial = false } = {}) => {
    if (!initial) setRefreshing(true);
    try {
      const orders = await fetchActiveOwnerOrders();
      const newOrders = orders.filter((order) => !knownIds.current.has(order.id) && order.payment_status === "paid");
      if (knownIds.current.size && newOrders.length) setNotice(`${newOrders.length} new paid order${newOrders.length === 1 ? "" : "s"} received.`);
      knownIds.current = new Set(orders.map((order) => order.id));
      setActive(orders);
      setError("");
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh({ initial: true });
    const timer = window.setInterval(() => { if (!busyRef.current) refresh(); }, 20000);
    const onFocus = () => { if (!busyRef.current) refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refresh]);

  async function showHistory() {
    setView("history"); setError(""); setHistoryLoading(true);
    try { setHistory(await fetchOwnerOrderHistory()); }
    catch (loadError) { setError(loadError.message); }
    finally { setHistoryLoading(false); }
  }

  async function transition(order, status) {
    busyRef.current = true;
    setBusyId(order.id); setError("");
    try {
      await updateOwnerOrderFulfillment(order.id, status, order.version, session.csrf_token);
      setNotice(status === "cancelled" ? `${order.reference} cancelled.` : `${order.reference} updated.`);
      setCancelOrder(null);
      await refresh();
    } catch (actionError) {
      setError(actionError.message);
      await refresh();
    } finally { busyRef.current = false; setBusyId(null); }
  }

  const counts = summarizeOwnerOrders(active);
  const now = new Date();
  const attentionCount = counts.failed + active.filter((order) => (
    order.payment_status === "paid"
    && new Date(order.requested_pickup_at).getTime() <= now.getTime() + 15 * 60000
  )).length;
  const orders = view === "active" ? active : history;
  const displayLoading = loading || (view === "history" && historyLoading);

  return (
    <section className="page-section owner-orders-page">
      <div className="owner-orders-heading">
        <div><p className="eyebrow">Today’s café queue</p><h1>Orders</h1><p>Paid orders are ready to prepare. Unpaid orders stay clearly separated.</p></div>
        <button className="secondary-button" disabled={refreshing || busyId !== null} type="button" onClick={() => refresh()}><RefreshCw size={17} /> {refreshing ? "Refreshing…" : "Refresh"}</button>
      </div>
      <div className="owner-order-summary" aria-label="Order summary">
        <button type="button" onClick={() => setView("active")}><span>New</span><strong>{loading ? "—" : counts.new}</strong></button>
        <button type="button" onClick={() => setView("active")}><span>Preparing</span><strong>{loading ? "—" : counts.preparing}</strong></button>
        <button type="button" onClick={() => setView("active")}><span>Ready</span><strong>{loading ? "—" : counts.ready}</strong></button>
        <button type="button" onClick={() => setView("active")}><span>Waiting for payment</span><strong>{loading ? "—" : counts.waiting}</strong></button>
        <button type="button" onClick={() => setView("active")}><span>Needs attention</span><strong>{loading ? "—" : attentionCount}</strong></button>
      </div>
      <div className="owner-orders-toolbar">
        <div role="tablist" aria-label="Order views">
          <button aria-selected={view === "active"} role="tab" type="button" onClick={() => setView("active")}>Active orders</button>
          <button aria-selected={view === "history"} role="tab" type="button" onClick={showHistory}>Recent history</button>
        </div>
        <span>{lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : "Not updated yet"}</span>
      </div>
      {notice ? <p className="owner-orders-notice" role="status"><CheckCircle2 size={18} /> {notice}</p> : null}
      {error ? <div className="owner-orders-error" role="alert"><AlertTriangle size={18} /><div><strong>Orders may be out of date.</strong><p>{error}</p></div><button type="button" onClick={() => view === "history" ? showHistory() : refresh()}>Try again</button></div> : null}
      {displayLoading ? <div className="owner-order-skeletons" aria-label="Loading orders"><div /><div /><div /></div> : null}
      {!displayLoading && !orders.length ? <div className="owner-orders-empty"><ShoppingBag size={28} /><h2>{view === "active" ? "No active orders" : "No recent order history"}</h2><p>{view === "active" ? "New paid orders will appear here automatically." : "Completed and cancelled orders will appear here."}</p></div> : null}
      {!displayLoading && orders.length ? <div className="owner-order-list">{orders.map((order) => <OrderCard busy={busyId === order.id} key={order.id} now={now} onAction={transition} onCancel={setCancelOrder} order={order} />)}</div> : null}
      {cancelOrder ? <CancelDialog busy={busyId === cancelOrder.id} onCancel={() => transition(cancelOrder, "cancelled")} onClose={() => setCancelOrder(null)} order={cancelOrder} /> : null}
    </section>
  );
}
