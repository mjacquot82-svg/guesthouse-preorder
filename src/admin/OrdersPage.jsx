import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { ACTIVE_ORDER_STATUSES, ORDER_STATUSES, useOrders } from "../stores/orderStore.js";

const workflowGroups = [
  { id: "active", title: "Active Orders" },
  { id: "completed", title: "Completed" },
  { id: "cancelled", title: "Cancelled" },
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

function getPickupDate(order) {
  const createdAt = new Date(order.createdAt);
  const match = String(order.pickupSummary || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

  if (!match || Number.isNaN(createdAt.getTime())) {
    return createdAt;
  }

  const [, rawHours, rawMinutes, period] = match;
  let hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (period.toLowerCase() === "pm" && hours < 12) {
    hours += 12;
  }

  if (period.toLowerCase() === "am" && hours === 12) {
    hours = 0;
  }

  const pickupDate = new Date(createdAt);
  pickupDate.setHours(hours, minutes, 0, 0);

  return pickupDate;
}

function getPickupLabel(order) {
  return order.pickupSummary || formatOrderTime(order.createdAt);
}

function sortByCreatedAtDesc(a, b) {
  return new Date(b.createdAt) - new Date(a.createdAt);
}

function sortByPickupTime(a, b) {
  return getPickupDate(a) - getPickupDate(b) || sortByCreatedAtDesc(a, b);
}

export default function OrdersPage() {
  const { orders, updateStatus } = useOrders();
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const groupedOrders = useMemo(
    () => ({
      active: orders
        .filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status))
        .sort(sortByPickupTime),
      completed: orders.filter((order) => order.status === "Completed").sort(sortByCreatedAtDesc),
      cancelled: orders.filter((order) => order.status === "Cancelled").sort(sortByCreatedAtDesc),
    }),
    [orders]
  );
  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ||
    groupedOrders.active[0] ||
    groupedOrders.completed[0] ||
    groupedOrders.cancelled[0] ||
    null;

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
          <p>Work active pickup orders first, then close or cancel when needed.</p>
        </div>
      </div>

      <div className="admin-order-board">
        {workflowGroups.map((group) => (
          <section className={`admin-order-column ${group.id}`} key={group.id}>
            <div className="admin-order-column-header">
              <h2>{group.title}</h2>
              <span>{groupedOrders[group.id]?.length || 0}</span>
            </div>

            <div className="admin-order-stack">
              {groupedOrders[group.id]?.length ? (
                groupedOrders[group.id].map((order) => (
                  <button
                    className={`admin-order-card${selectedOrder?.id === order.id ? " selected" : ""}`}
                    type="button"
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <b className="admin-order-pickup">{getPickupLabel(order)}</b>
                    <strong>{order.customerName || "Guest order"}</strong>
                    <span>{order.status} - ordered {formatOrderTime(order.createdAt)}</span>
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
              <strong className="admin-order-detail-pickup">
                <Clock3 size={18} strokeWidth={2.4} />
                {getPickupLabel(selectedOrder)}
              </strong>
              <p>
                {selectedOrder.customerEmail} {selectedOrder.customerPhone ? `- ${selectedOrder.customerPhone}` : ""}
              </p>
            </div>
            <strong className={`order-status-pill status-${selectedOrder.status.toLowerCase().replaceAll(" ", "-")}`}>
              {selectedOrder.status}
            </strong>
          </div>

          <div className="admin-order-actions">
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
            <span>Internal status</span>
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
