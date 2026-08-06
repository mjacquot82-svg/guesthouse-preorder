import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Mail, MessageSquareText, RefreshCw } from "lucide-react";
import { fetchOwnerCommunications } from "../services/ownerCommunicationsApi.js";

const labels = { email: "Email", sms: "SMS", email_sms: "Email + SMS", disabled: "Disabled" };
const healthLabel = { connected: "Connected", healthy: "Healthy", not_configured: "Action required" };

export default function CommunicationsPage() {
  const [state, setState] = useState({ status: "loading", data: null, message: "" });
  const load = useCallback(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: "loading", message: "" }));
    fetchOwnerCommunications({ signal: controller.signal })
      .then((data) => setState({ status: "ready", data, message: "" }))
      .catch((error) => {
        if (error?.name !== "AbortError") setState({ status: "error", data: null, message: error.message });
      });
    return controller;
  }, []);
  useEffect(() => { const controller = load(); return () => controller.abort(); }, [load]);

  if (state.status === "loading" && !state.data) return <section className="page-section communication-page" aria-live="polite"><div className="page-heading"><h1>Communications</h1><p>Checking customer communication status…</p></div><div className="communications-skeleton" /></section>;
  if (state.status === "error") return <section className="page-section communication-page"><div className="page-heading"><h1>Communications</h1><p>One place to understand customer messages and delivery health.</p></div><div className="communications-error" role="alert"><AlertTriangle /><div><strong>Communication status is unavailable.</strong><p>{state.message}</p></div><button className="secondary-button" type="button" onClick={load}><RefreshCw size={16} /> Try again</button></div></section>;

  const { activity, health, orders, summary, templates } = state.data;
  return <section className="page-section communication-page">
    <div className="page-heading communication-heading"><div><p className="eyebrow">Customer operations</p><h1>Communications</h1><p>See who has been contacted, what needs attention, and which delivery channels are ready.</p></div><button className="secondary-button" disabled={state.status === "loading"} type="button" onClick={load}><RefreshCw size={16} /> Refresh</button></div>
    <div className="communication-summary" aria-label="Notification summary">{[
      ["Pending notifications", summary.pending], ["Sent today", summary.sent_today], ["Failed", summary.failed], ["Scheduled", summary.scheduled],
    ].map(([label, value]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><p>{value ? "Review activity below" : "Nothing needs attention"}</p></article>)}</div>

    <div className="communication-layout">
      <section className="communications-panel communications-orders" aria-labelledby="order-notifications-heading"><div className="panel-heading"><div><h2 id="order-notifications-heading">Order notifications</h2><p>Current customer contact readiness by order.</p></div><MessageSquareText /></div>
        {orders.length ? <div className="communication-table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Notification</th><th>Delivery</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.reference}</strong><small>{order.payment_status}</small></td><td><strong>{order.customer_name}</strong><small>{order.customer_email}</small></td><td>{order.event}</td><td><span className="status-pill disabled">{labels[order.channel]}</span></td></tr>)}</tbody></table></div> : <div className="communication-empty"><Mail /><h3>No orders yet</h3><p>Orders capable of customer communication will appear here.</p></div>}
      </section>

      <section className="communications-panel" aria-labelledby="health-heading"><div className="panel-heading"><div><h2 id="health-heading">Communication health</h2><p>Provider and queue readiness.</p></div></div><div className="health-list">{health.map((item) => <article key={item.key}><span className={`health-icon ${item.status}`}>{item.status === "connected" || item.status === "healthy" ? <CheckCircle2 /> : <AlertTriangle />}</span><div><strong>{item.name}</strong><p>{item.detail}</p></div><span className={`status-pill ${item.status}`}>{healthLabel[item.status] || item.status}</span></article>)}</div></section>
    </div>

    <section className="communications-panel" aria-labelledby="activity-heading"><div className="panel-heading"><div><h2 id="activity-heading">Notification queue</h2><p>Recent sends, failures, and retries.</p></div></div>{activity.length ? <div className="communication-table-wrap"><table><thead><tr><th>Time</th><th>Customer</th><th>Order</th><th>Type</th><th>Status</th><th>Action</th></tr></thead><tbody>{activity.map((item) => <tr key={item.id}><td>{new Date(item.occurred_at).toLocaleString()}</td><td>{item.customer}</td><td>{item.order_reference || "—"}</td><td>{item.notification_type}</td><td>{item.status}</td><td>{item.retryable ? <button className="secondary-button" type="button">Retry</button> : "—"}</td></tr>)}</tbody></table></div> : <div className="communication-empty compact"><CheckCircle2 /><div><h3>No delivery activity</h3><p>A delivery queue is not configured yet. No messages are being silently marked as sent.</p></div></div>}</section>

    <section className="communications-panel" aria-labelledby="templates-heading"><div className="panel-heading"><div><h2 id="templates-heading">Notification templates</h2><p>Read-only template catalog. Editing can be added without changing this layout.</p></div></div><div className="template-grid">{templates.map((template) => <article key={template.key}><span>{template.category}</span><h3>{template.name}</h3><p>{labels[template.channel]}</p><small>{template.status}</small></article>)}</div></section>
  </section>;
}
