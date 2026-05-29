import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Coffee,
  DollarSign,
  ReceiptText,
  RefreshCw,
  Sandwich,
  Star,
} from "lucide-react";
import { fetchAdminAnalytics } from "../services/analyticsService.js";

const emptyAnalytics = {
  orders: { today: 0, week: 0, month: 0 },
  revenue: { today: 0, week: 0, month: 0 },
  averages: { orderValue: 0, ordersPerDay: 0 },
  popularItems: { drink: null, food: null, dailySpecial: null },
  recentOrders: [],
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}

function formatNumber(value, options = {}) {
  return new Intl.NumberFormat("en-US", options).format(Number(value) || 0);
}

function formatOrderTime(date) {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function KpiCard({ icon: Icon, label, value, note }) {
  return (
    <article className="admin-metric-card">
      <Icon size={20} strokeWidth={2.35} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function PopularItemCard({ icon: Icon, label, item }) {
  return (
    <article className="admin-popular-card">
      <Icon size={19} strokeWidth={2.35} aria-hidden="true" />
      <span>{label}</span>
      <strong>{item?.name || "No sales yet"}</strong>
      <p>{item ? `${formatNumber(item.quantity)} sold this month` : "Current month"}</p>
    </article>
  );
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  async function loadAnalytics() {
    setLoading(true);

    try {
      const nextAnalytics = await fetchAdminAnalytics();
      setAnalytics(nextAnalytics);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  return (
    <section className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Coffee shop analytics</p>
          <h1>Analytics</h1>
          <p>Quick operating numbers from orders, order items, and daily specials.</p>
        </div>
        <button className="secondary-button" type="button" onClick={loadAnalytics} disabled={loading}>
          <RefreshCw size={17} strokeWidth={2.35} aria-hidden="true" />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {status ? <p className="form-status">{status}</p> : null}

      <div className="admin-analytics-section-heading">
        <h2>Orders</h2>
        <span>Excludes cancelled orders</span>
      </div>
      <div className="admin-metric-grid">
        <KpiCard icon={ReceiptText} label="Orders Today" value={formatNumber(analytics.orders.today)} note="Since opening today" />
        <KpiCard icon={CalendarDays} label="Orders This Week" value={formatNumber(analytics.orders.week)} note="Since Sunday" />
        <KpiCard icon={BarChart3} label="Orders This Month" value={formatNumber(analytics.orders.month)} note="Month to date" />
        <KpiCard
          icon={ReceiptText}
          label="Average Orders Per Day"
          value={formatNumber(analytics.averages.ordersPerDay, { maximumFractionDigits: 1 })}
          note="Month to date pace"
        />
      </div>

      <div className="admin-analytics-section-heading">
        <h2>Revenue</h2>
        <span>Based on order totals</span>
      </div>
      <div className="admin-metric-grid">
        <KpiCard icon={DollarSign} label="Revenue Today" value={formatCurrency(analytics.revenue.today)} note="Since opening today" />
        <KpiCard icon={DollarSign} label="Revenue This Week" value={formatCurrency(analytics.revenue.week)} note="Since Sunday" />
        <KpiCard icon={DollarSign} label="Revenue This Month" value={formatCurrency(analytics.revenue.month)} note="Month to date" />
        <KpiCard
          icon={DollarSign}
          label="Average Order Value"
          value={formatCurrency(analytics.averages.orderValue)}
          note="Month to date average"
        />
      </div>

      <section className="admin-panel admin-analytics-panel" aria-labelledby="popular-items-heading">
        <div className="admin-analytics-section-heading">
          <h2 id="popular-items-heading">Popular Items</h2>
          <span>Current month</span>
        </div>
        <div className="admin-popular-grid">
          <PopularItemCard icon={Coffee} label="Most Popular Drink" item={analytics.popularItems.drink} />
          <PopularItemCard icon={Sandwich} label="Most Popular Food Item" item={analytics.popularItems.food} />
          <PopularItemCard icon={Star} label="Most Popular Daily Special" item={analytics.popularItems.dailySpecial} />
        </div>
      </section>

      <section className="admin-panel admin-analytics-panel" aria-labelledby="recent-activity-heading">
        <div className="admin-analytics-section-heading">
          <h2 id="recent-activity-heading">Recent Activity</h2>
          <span>Last 10 orders</span>
        </div>
        <div className="admin-recent-orders-list">
          {analytics.recentOrders.length ? (
            analytics.recentOrders.map((order) => (
              <article className="admin-recent-order-row" key={order.id}>
                <div>
                  <strong>{order.customerName}</strong>
                  <span>{formatOrderTime(order.createdAt)}</span>
                </div>
                <div>
                  <span>Order Total</span>
                  <strong>{formatCurrency(order.total)}</strong>
                </div>
                <div>
                  <span>Pickup Time</span>
                  <strong>{order.pickupTime}</strong>
                </div>
              </article>
            ))
          ) : (
            <p className="admin-empty-note">No recent orders yet.</p>
          )}
        </div>
      </section>
    </section>
  );
}
