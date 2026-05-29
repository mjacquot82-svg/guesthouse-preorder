import { Link } from "react-router-dom";
import { Clock3, ReceiptText } from "lucide-react";
import { useCustomerSession } from "../stores/customerAuthStore.js";
import { ACTIVE_ORDER_STATUSES, getLastOrderId, useOrders } from "../stores/orderStore.js";

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export default function OrdersPageMobile() {
  const { customer } = useCustomerSession();
  const { activeOrders } = useOrders();
  const lastOrderId = getLastOrderId();
  const visibleOrders = customer
    ? activeOrders.filter((order) => order.customerId === customer.id)
    : activeOrders.filter((order) => order.id === lastOrderId);

  return (
    <section className="page-section ordering-page app-simple-page">
      <div className="ordering-top-card compact-app-heading">
        <div>
          <p className="eyebrow">Order updates</p>
          <h1>Orders</h1>
          <p>Track your café orders and pickup timing.</p>
        </div>
      </div>

      <div className="content-block app-content-block app-status-card">
        <span className="status-icon" aria-hidden="true">
          <ReceiptText size={20} strokeWidth={2.4} />
        </span>
        <div>
          <h2>{visibleOrders.length ? "Active orders" : "No active orders"}</h2>
          <p>
            {visibleOrders.length
              ? "Track pickup status for orders that are still moving through the bar."
              : "Your next coffee or breakfast order will appear here after checkout."}
          </p>
        </div>
        {!visibleOrders.length ? (
          <Link className="primary-button" to="/menu">
            Browse menu
          </Link>
        ) : null}
      </div>

      {visibleOrders.length ? (
        <div className="order-history-list">
          {visibleOrders.map((order) => (
            <article className="content-block app-content-block order-history-card" key={order.id}>
              <div>
                <span>{new Date(order.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</span>
                <h2>{order.status}</h2>
                <p>{order.items.map((item) => item.productName).join(", ")}</p>
              </div>
              <strong>{formatPrice(order.total)}</strong>
            </article>
          ))}
        </div>
      ) : null}

      <div className="content-block app-content-block compact-info-row">
        <Clock3 size={18} strokeWidth={2.4} />
        <span>Pickup statuses: {ACTIVE_ORDER_STATUSES.join(", ")}</span>
      </div>
    </section>
  );
}
