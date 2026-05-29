import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, Phone, Volume2 } from "lucide-react";
import { ACTIVE_ORDER_STATUSES, useOrders } from "../stores/orderStore.js";

const PICKUP_APPROACHING_THRESHOLD_MINUTES = 15;
const NEW_ORDER_HIGHLIGHT_MS = 30000;

const pickupLegend = [
  {
    id: "future",
    label: "Future Order",
    description: "Pickup time comfortably in the future.",
  },
  {
    id: "approaching",
    label: "Pickup Time Approaching",
    description: `Pickup time within ${PICKUP_APPROACHING_THRESHOLD_MINUTES} minutes.`,
  },
  {
    id: "passed",
    label: "Pickup Time Passed",
    description: "Pickup time has passed and order may be late.",
  },
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

  if (pickupDate < createdAt && createdAt.getTime() - pickupDate.getTime() > 12 * 60 * 60 * 1000) {
    pickupDate.setDate(pickupDate.getDate() + 1);
  }

  return pickupDate;
}

function getPickupLabel(order) {
  return order.pickupSummary || formatOrderTime(order.createdAt);
}

function getOrderSummary(order) {
  return order.items.map((item) => `${item.quantity} x ${item.productName}`).join(", ");
}

function getPickupUrgency(order) {
  const pickupDate = getPickupDate(order);
  const minutesUntilPickup = (pickupDate.getTime() - Date.now()) / 60000;

  if (minutesUntilPickup < 0) {
    return "passed";
  }

  if (minutesUntilPickup <= PICKUP_APPROACHING_THRESHOLD_MINUTES) {
    return "approaching";
  }

  return "future";
}

function sortByCreatedAtDesc(a, b) {
  return new Date(b.createdAt) - new Date(a.createdAt);
}

function sortByPickupTime(a, b) {
  return getPickupDate(a) - getPickupDate(b) || sortByCreatedAtDesc(a, b);
}

function formatModifiers(item) {
  return item.selectedModifiers
    .map((modifier) => `${modifier.groupName}: ${modifier.name}`)
    .join(", ");
}

export default function OrdersPage() {
  const audioContextRef = useRef(null);
  const alertedOrderIdsRef = useRef(new Set());
  const highlightTimersRef = useRef(new Map());
  const [highlightedOrderIds, setHighlightedOrderIds] = useState(() => new Set());
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [soundReady, setSoundReady] = useState(false);
  const playNotificationSound = useCallback(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const audioContext = audioContextRef.current || new AudioContext();
    audioContextRef.current = audioContext;

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.32);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.34);
  }, []);
  const enableNotificationSound = useCallback(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const audioContext = audioContextRef.current || new AudioContext();
    audioContextRef.current = audioContext;
    audioContext.resume().then(() => setSoundReady(true)).catch(() => {});
  }, []);
  const handleRealtimeNewOrder = useCallback(
    (orderId) => {
      if (alertedOrderIdsRef.current.has(orderId)) {
        return;
      }

      alertedOrderIdsRef.current.add(orderId);
      setHighlightedOrderIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(orderId);
        return nextIds;
      });

      window.clearTimeout(highlightTimersRef.current.get(orderId));
      highlightTimersRef.current.set(
        orderId,
        window.setTimeout(() => {
          setHighlightedOrderIds((currentIds) => {
            const nextIds = new Set(currentIds);
            nextIds.delete(orderId);
            return nextIds;
          });
          highlightTimersRef.current.delete(orderId);
        }, NEW_ORDER_HIGHLIGHT_MS)
      );

      playNotificationSound();
    },
    [playNotificationSound]
  );
  const { orders, markReady } = useOrders({
    realtime: true,
    onRealtimeNewOrder: handleRealtimeNewOrder,
  });
  const groupedOrders = useMemo(
    () => ({
      active: orders
        .filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status))
        .sort(sortByPickupTime),
      completed: orders.filter((order) => order.status === "Completed").sort(sortByCreatedAtDesc),
    }),
    [orders]
  );
  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ||
    groupedOrders.active[0] ||
    groupedOrders.completed[0] ||
    null;
  const selectedOrderIsActive = selectedOrder
    ? ACTIVE_ORDER_STATUSES.includes(selectedOrder.status)
    : false;

  async function markSelectedOrderReady(order) {
    await markReady(order.id);
    setSelectedOrderId("");
  }

  useEffect(() => {
    return () => {
      highlightTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      highlightTimersRef.current.clear();
      audioContextRef.current?.close?.();
    };
  }, []);

  return (
    <section className="admin-page admin-orders-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Cafe operations</p>
          <h1>Orders</h1>
          <p>Keep this screen open to work pickups by requested time.</p>
        </div>
        <button
          className={`admin-sound-toggle${soundReady ? " enabled" : ""}`}
          type="button"
          onClick={enableNotificationSound}
          title="Enable order notification sound"
          aria-label="Enable order notification sound"
        >
          <Volume2 size={17} strokeWidth={2.4} />
          {soundReady ? "Sound on" : "Enable sound"}
        </button>
      </div>

      <section className="pickup-legend" aria-label="Pickup timing color legend">
        {pickupLegend.map((item) => (
          <div className={`pickup-legend-item ${item.id}`} key={item.id}>
            <span aria-hidden="true" />
            <div>
              <strong>{item.label}</strong>
              <p>{item.description}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="admin-order-board pickup-order-board">
        <section className="admin-order-column active">
          <div className="admin-order-column-header">
            <h2>Active Orders</h2>
            <span>{groupedOrders.active.length}</span>
          </div>

          <div className="admin-order-stack">
            {groupedOrders.active.length ? (
              groupedOrders.active.map((order) => (
                <button
                  className={`admin-order-card pickup-${getPickupUrgency(order)}${
                    selectedOrder?.id === order.id ? " selected" : ""
                  }${highlightedOrderIds.has(order.id) ? " new-order-highlight" : ""
                  }`}
                  type="button"
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <b className="admin-order-pickup">{getPickupLabel(order)}</b>
                  <strong>{order.customerName || "Guest order"}</strong>
                  <small>{getOrderSummary(order)}</small>
                  {order.notes ? <em>{order.notes}</em> : null}
                  <b>{formatPrice(order.total)}</b>
                </button>
              ))
            ) : (
              <p className="admin-order-empty">No active orders</p>
            )}
          </div>
        </section>

        <section className="admin-order-column completed">
          <div className="admin-order-column-header">
            <h2>Completed Orders</h2>
            <span>{groupedOrders.completed.length}</span>
          </div>

          <div className="admin-order-stack">
            {groupedOrders.completed.length ? (
              groupedOrders.completed.map((order) => (
                <button
                  className={`admin-order-card completed-order-card${
                    selectedOrder?.id === order.id ? " selected" : ""
                  }`}
                  type="button"
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <b className="admin-order-pickup">{getPickupLabel(order)}</b>
                  <strong>{order.customerName || "Guest order"}</strong>
                  <span>
                    Completed {order.completedAt ? formatOrderTime(order.completedAt) : "recently"}
                  </span>
                  <small>{getOrderSummary(order)}</small>
                  <b>{formatPrice(order.total)}</b>
                </button>
              ))
            ) : (
              <p className="admin-order-empty">No completed orders</p>
            )}
          </div>
        </section>
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
                <Phone size={15} strokeWidth={2.4} />
                {selectedOrder.customerPhone || "No phone provided"}
              </p>
            </div>
            {selectedOrder.completedAt ? (
              <strong className="order-status-pill status-completed">
                Completed {formatOrderTime(selectedOrder.completedAt)}
              </strong>
            ) : null}
          </div>

          {selectedOrderIsActive ? (
            <div className="admin-order-actions">
              <button
                className="primary-order-action"
                type="button"
                onClick={() => markSelectedOrderReady(selectedOrder)}
              >
                <CheckCircle2 size={17} strokeWidth={2.4} />
                Order Ready
              </button>
            </div>
          ) : null}

          <ul className="admin-order-items">
            {selectedOrder.items.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>
                    {item.quantity} x {item.variantName ? `${item.variantName} ` : ""}
                    {item.productName}
                  </strong>
                  {item.selectedModifiers.length ? <span>{formatModifiers(item)}</span> : null}
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
