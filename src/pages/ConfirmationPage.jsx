import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { getLastOrderId, useOrder } from "../stores/orderStore.js";

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export default function ConfirmationPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const orderId = location.state?.orderId || searchParams.get("order") || getLastOrderId();
  const { order, loading } = useOrder(orderId);

  return (
    <section className="page-section compact-section ordering-page">
      <div className="confirmation-panel">
        <span className="confirmation-icon" aria-hidden="true">
          <CheckCircle2 size={24} strokeWidth={2.4} />
        </span>
        <h1>Order received</h1>
        {order ? (
          <>
            <p>
              We have your order for {order.customerName}. Status is {order.status}.
              {order.pickupSummary ? ` ${order.pickupSummary}.` : ""}
            </p>
            <div className="confirmation-summary">
              <span>Order #{order.id.slice(0, 8)}</span>
              <strong>{formatPrice(order.total)}</strong>
            </div>
            <ul className="order-item-list">
              {order.items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.quantity} x {item.variantName ? `${item.variantName} ` : ""}
                    {item.productName}
                  </span>
                  <strong>{formatPrice(item.totalPrice)}</strong>
                </li>
              ))}
            </ul>
          </>
        ) : loading ? (
          <p>Loading your order details.</p>
        ) : (
          <p>Your order has been received.</p>
        )}
        <div className="confirmation-actions">
          <Link className="primary-button" to="/orders">
            Track order
          </Link>
          <Link className="secondary-button" to="/">
            Return Home
          </Link>
        </div>
      </div>
    </section>
  );
}
