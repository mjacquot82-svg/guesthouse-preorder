import { useEffect, useMemo, useState } from "react";

export const ORDER_STATUSES = ["New", "Preparing", "Ready for Pickup", "Completed", "Cancelled"];
export const ACTIVE_ORDER_STATUSES = ["New", "Preparing", "Ready for Pickup"];

const ORDERS_STORAGE_KEY = "cedar-oak-orders";
const LAST_ORDER_KEY = "cedar-oak-last-order-id";
const ORDERS_UPDATED_EVENT = "cedar-oak-orders-updated";

function createOrderId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readJsonStorage(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    return JSON.parse(window.localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function normalizeOrderItem(item) {
  const quantity = Number(item.quantity) || 1;
  const unitPrice = Number(item.unitPrice ?? item.price) || 0;

  return {
    id: item.id || `${item.productId || item.productName}-${Date.now()}`,
    productId: item.productId || "",
    variantId: item.variantId || "",
    productName: item.productName || item.name || "Cafe item",
    variantName: item.variantName || "",
    selectedModifiers: Array.isArray(item.selectedModifiers)
      ? item.selectedModifiers.map((modifier) => ({
          groupId: modifier.groupId || "",
          groupName: modifier.groupName || "",
          optionId: modifier.optionId || modifier.id || "",
          name: modifier.name || "",
          priceDelta: Number(modifier.priceDelta ?? modifier.priceAdjustment) || 0,
        }))
      : [],
    quantity,
    unitPrice,
    totalPrice: Number(item.totalPrice ?? unitPrice * quantity) || 0,
    cartItem: item.cartItem || null,
  };
}

function normalizeOrder(order) {
  const items = Array.isArray(order.items) ? order.items.map(normalizeOrderItem) : [];
  const subtotal = Number(order.subtotal ?? items.reduce((sum, item) => sum + item.totalPrice, 0)) || 0;

  return {
    id: order.id || createOrderId(),
    customerId: order.customerId || "",
    customerName: order.customerName || "",
    customerEmail: order.customerEmail || "",
    customerPhone: order.customerPhone || "",
    createdAt: order.createdAt || new Date().toISOString(),
    status: ORDER_STATUSES.includes(order.status) ? order.status : "New",
    subtotal,
    total: Number(order.total ?? subtotal) || 0,
    notes: order.notes || "",
    pickupSummary: order.pickupSummary || "",
    items,
  };
}

function readOrders() {
  return readJsonStorage(ORDERS_STORAGE_KEY, []).map(normalizeOrder);
}

function writeOrders(orders) {
  window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders.map(normalizeOrder)));
  window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
}

export function getOrders() {
  return readOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getOrderById(orderId) {
  return readOrders().find((order) => order.id === orderId) || null;
}

export function getLastOrderId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(LAST_ORDER_KEY) || "";
}

export function createOrder({ cart, customer, contact, notes, pickupSummary }) {
  const createdAt = new Date().toISOString();
  const items = cart.map((item) =>
    normalizeOrderItem({
      ...item,
      productName: item.name,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
      cartItem: item,
    })
  );
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const order = normalizeOrder({
    id: createOrderId(),
    customerId: customer?.id || "",
    customerName: contact.name,
    customerEmail: contact.email,
    customerPhone: contact.phoneNumber || contact.phone || "",
    createdAt,
    status: "New",
    subtotal,
    total: subtotal,
    notes,
    pickupSummary,
    items,
  });
  const nextOrders = [order, ...readOrders()];

  writeOrders(nextOrders);
  window.localStorage.setItem(LAST_ORDER_KEY, order.id);

  return order;
}

export function updateOrderStatus(orderId, status) {
  if (!ORDER_STATUSES.includes(status)) {
    return null;
  }

  const nextOrders = readOrders().map((order) =>
    order.id === orderId ? { ...order, status } : order
  );
  writeOrders(nextOrders);

  return nextOrders.find((order) => order.id === orderId) || null;
}

export function useOrders() {
  const [orders, setOrders] = useState(getOrders);

  useEffect(() => {
    function handleOrdersUpdate() {
      setOrders(getOrders());
    }

    window.addEventListener("storage", handleOrdersUpdate);
    window.addEventListener(ORDERS_UPDATED_EVENT, handleOrdersUpdate);

    return () => {
      window.removeEventListener("storage", handleOrdersUpdate);
      window.removeEventListener(ORDERS_UPDATED_EVENT, handleOrdersUpdate);
    };
  }, []);

  return useMemo(
    () => ({
      orders,
      activeOrders: orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status)),
      completedOrders: orders.filter((order) => order.status === "Completed"),
      newOrders: orders.filter((order) => order.status === "New"),
      updateStatus: updateOrderStatus,
    }),
    [orders]
  );
}

export function useCustomerOrders(customerId) {
  const { orders } = useOrders();

  return orders.filter((order) => order.customerId && order.customerId === customerId);
}
