import { useMemo, useState } from "react";
import { CheckCircle2, CookingPot, PackageCheck, XCircle } from "lucide-react";
import { ORDER_STATUSES, useOrders } from "../stores/orderStore.js";

const statusColumns = [
  "New",
  "Preparing",
  "Ready for Pickup",
  "Completed",
  "Cancelled",
];

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

function formatOrderTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export default function OrdersPage() {
  const { orders, updateStatus } = useOrders();
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || orders[0] || null;
  const ordersByStatus = useMemo(
    () =>
      statusColumns.reduce(
        (groups, status) => ({
          ...groups,
          [status]: orders.filter((order) => order.status === status),
        }),
        {}
      ),
    [orders]
  );

  function setStatus(order, status) {
    updateStatus(order.id, status);
    setSelectedOrderId(order.id);
  }

  return (
    <section className="admin-page admin-orders-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Cafe operations</p>
          <h1>Orders</h1>
          <p>Review incoming orders, move prep status, and close pickup orders.</p>
        </div>
      </div>

      <div className="admin-order-board">
        {statusColumns.map((status) => (
          <section className="admin-order-column" key={status}>
            <div className="admin-order-column-header">
              <h2>{status === "Ready for Pickup" ? "Ready" : status}</h2>
              <span>{ordersByStatus[status]?.length || 0}</span>
            </div>

            <div className="admin-order-stack">
              {ordersByStatus[status]?.length ? (
                ordersByStatus[status].map((order) => (
                  <button
                    className={`admin-order-card${selectedOrder?.id === order.id ? " selected" : ""}`}
                    type="button"
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <span>{formatOrderTime(order.createdAt)}</span>
                    <strong>{order.customerName || "Guest order"}</strong>
                    <small>{order.items.map((item) => item.productName).join(", ")}</small>
                    <b>{formatPrice(order.total)}</b>
                  </button>
                ))
              ) : (
                <p className="admin-order-empty">No orders</p>
              )}
            </div>
          </section>
        ))}
      </div>

      {selectedOrder ? (
        <section className="admin-panel admin-order-detail">
          <div className="admin-order-detail-heading">
            <div>
              <span>Order #{selectedOrder.id.slice(0, 8)}</span>
              <h2>{selectedOrder.customerName || "Guest order"}</h2>
              <p>
                {selectedOrder.customerEmail} {selectedOrder.customerPhone ? `- ${selectedOrder.customerPhone}` : ""}
              </p>
            </div>
            <strong className={`order-status-pill status-${selectedOrder.status.toLowerCase().replaceAll(" ", "-")}`}>
              {selectedOrder.status}
            </strong>
          </div>

          <div className="admin-order-actions">
            <button type="button" onClick={() => setStatus(selectedOrder, "Preparing")}>
              <CookingPot size={17} strokeWidth={2.4} />
              Preparing
            </button>
            <button type="button" onClick={() => setStatus(selectedOrder, "Ready for Pickup")}>
              <PackageCheck size={17} strokeWidth={2.4} />
              Mark Ready
            </button>
            <button type="button" onClick={() => setStatus(selectedOrder, "Completed")}>
              <CheckCircle2 size={17} strokeWidth={2.4} />
              Complete
            </button>
            <button type="button" onClick={() => setStatus(selectedOrder, "Cancelled")}>
              <XCircle size={17} strokeWidth={2.4} />
              Cancel
            </button>
          </div>

          <label className="admin-form">
            <span>Status</span>
            <select
              value={selectedOrder.status}
              onChange={(event) => setStatus(selectedOrder, event.target.value)}
            >
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <ul className="admin-order-items">
            {selectedOrder.items.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>
                    {item.quantity} x {item.variantName ? `${item.variantName} ` : ""}
                    {item.productName}
                  </strong>
                  {item.selectedModifiers.length ? (
                    <span>
                      {item.selectedModifiers
                        .map((modifier) => `${modifier.groupName}: ${modifier.name}`)
                        .join(", ")}
                    </span>
                  ) : null}
                </div>
                <b>{formatPrice(item.totalPrice)}</b>
              </li>
            ))}
          </ul>

          {selectedOrder.notes ? (
            <div className="admin-order-notes">
              <span>Notes</span>
              <p>{selectedOrder.notes}</p>
            </div>
          ) : null}

          <div className="cart-total-row">
            <span>Total</span>
            <strong>{formatPrice(selectedOrder.total)}</strong>
          </div>
        </section>
      ) : (
        <section className="admin-panel">
          <h2>No orders yet</h2>
          <p>Customer checkout orders will appear here.</p>
        </section>
      )}
    </section>
  );
}
