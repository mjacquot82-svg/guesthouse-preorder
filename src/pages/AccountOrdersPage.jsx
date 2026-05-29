import { Link, Navigate, useNavigate } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { useCustomerSession } from "../stores/customerAuthStore.js";
import { storeCart } from "../stores/cartStore.js";
import { useCustomerOrders } from "../stores/orderStore.js";

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

function formatOrderDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

function getOrderSummary(order) {
  return order.items
    .map((item) => `${item.variantName ? `${item.variantName} ` : ""}${item.productName}`)
    .join(", ");
}

export default function AccountOrdersPage() {
  const navigate = useNavigate();
  const { customer, isAuthenticated } = useCustomerSession();
  const orders = useCustomerOrders(customer?.id);

  if (!isAuthenticated) {
    return <Navigate to="/account/login" replace state={{ from: "/account/orders" }} />;
  }

  function reorder(order) {
    const nextCart = order.items.map((item) => ({
      ...(item.cartItem || {}),
      id: item.cartItem?.id || item.id,
      productId: item.productId,
      variantId: item.variantId,
      name: item.productName,
      variantName: item.variantName,
      price: item.unitPrice,
      finalPrice: item.unitPrice,
      selectedModifiers: item.selectedModifiers,
      options: item.selectedModifiers,
      quantity: item.quantity,
    }));

    storeCart(nextCart);
    navigate("/cart");
  }

  return (
    <section className="page-section ordering-page app-simple-page">
      <div className="ordering-top-card compact-app-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Order History</h1>
          <p>Review previous café orders and rebuild one into your cart.</p>
        </div>
      </div>

      {orders.length ? (
        <div className="order-history-list">
          {orders.map((order) => (
            <article className="content-block app-content-block order-history-card" key={order.id}>
              <div className="order-history-main">
                <div className="order-history-heading">
                  <div>
                    <span>{formatOrderDate(order.createdAt)}</span>
                    <h2>{order.status}</h2>
                  </div>
                  <strong>{formatPrice(order.total)}</strong>
                </div>
                <p>{getOrderSummary(order)}</p>
                <details>
                  <summary>View order</summary>
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
                </details>
              </div>
              <button className="secondary-button" type="button" onClick={() => reorder(order)}>
                <RotateCcw size={17} strokeWidth={2.4} />
                Reorder
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No orders yet</h2>
          <p>Your placed orders will appear here after checkout.</p>
          <Link className="primary-button" to="/menu">
            Browse menu
          </Link>
        </div>
      )}
    </section>
  );
}
