import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import {
  ORDER_STATUSES,
  buildOrderFromCheckout,
  createOrderInSupabase,
  fetchOrderByIdFromSupabase,
  fetchOrdersFromSupabase,
  normalizeOrder,
  updateOrderStatusInSupabase,
} from "../services/orderService.js";
import { emitOrderReadyForPickup } from "../services/orderNotificationHooks.js";

export { ORDER_STATUSES };
export const ACTIVE_ORDER_STATUSES = ["New", "Preparing"];
export const WAITING_FOR_PICKUP_STATUS = "Ready for Pickup";
export const ARCHIVED_ORDER_STATUS = "Completed";
export const OPEN_ORDER_STATUSES = [...ACTIVE_ORDER_STATUSES, WAITING_FOR_PICKUP_STATUS];

const ORDERS_STORAGE_KEY = "cedar-oak-orders";
const LAST_ORDER_KEY = "cedar-oak-last-order-id";
const ORDERS_UPDATED_EVENT = "cedar-oak-orders-updated";

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

function dispatchOrdersUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ORDERS_UPDATED_EVENT));
  }
}

function readLocalOrders() {
  return readJsonStorage(ORDERS_STORAGE_KEY, []).map(normalizeOrder);
}

function writeLocalOrders(orders) {
  window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders.map(normalizeOrder)));
  dispatchOrdersUpdated();
}

function sortOrders(orders) {
  return [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function storeLastOrderId(orderId) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LAST_ORDER_KEY, orderId);
  }
}

function createLocalOrder(order) {
  const normalizedOrder = normalizeOrder(order);
  writeLocalOrders([normalizedOrder, ...readLocalOrders()]);
  storeLastOrderId(normalizedOrder.id);

  return normalizedOrder;
}

function updateLocalOrderStatus(orderId, status) {
  const nextOrders = readLocalOrders().map((order) =>
    order.id === orderId
      ? {
          ...order,
          status,
          completedAt: status === "Completed" ? new Date().toISOString() : "",
        }
      : order
  );
  writeLocalOrders(nextOrders);

  return nextOrders.find((order) => order.id === orderId) || null;
}

export function getOrders() {
  return sortOrders(readLocalOrders());
}

export function getOrderById(orderId) {
  return readLocalOrders().find((order) => order.id === orderId) || null;
}

export function getLastOrderId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(LAST_ORDER_KEY) || "";
}

export async function fetchOrders() {
  if (!isSupabaseConfigured) {
    return getOrders();
  }

  try {
    return await fetchOrdersFromSupabase();
  } catch (error) {
    console.warn("Falling back to local orders:", error);
    return getOrders();
  }
}

export async function fetchOrderById(orderId) {
  if (!orderId) {
    return null;
  }

  if (!isSupabaseConfigured) {
    return getOrderById(orderId);
  }

  try {
    return await fetchOrderByIdFromSupabase(orderId);
  } catch (error) {
    console.warn("Falling back to local order:", error);
    return getOrderById(orderId);
  }
}

export async function createOrder(checkout) {
  const order = buildOrderFromCheckout(checkout);
  console.info("[orders] createOrder built payload", order);

  if (!isSupabaseConfigured) {
    console.info("[orders] Supabase is not configured; creating local order.");
    return createLocalOrder(order);
  }

  try {
    console.info("[orders] attempting Supabase order create", { orderId: order.id });
    const createdOrder = await createOrderInSupabase(order);
    storeLastOrderId(order.id);
    dispatchOrdersUpdated();

    console.info("[orders] Supabase order create succeeded", createdOrder);
    return createdOrder || order;
  } catch (error) {
    console.error("[orders] Supabase order create failed", error);
    throw error;
  }
}

export async function updateOrderStatus(orderId, status) {
  if (!ORDER_STATUSES.includes(status)) {
    return null;
  }

  if (!isSupabaseConfigured) {
    return updateLocalOrderStatus(orderId, status);
  }

  try {
    const updatedOrder = await updateOrderStatusInSupabase(orderId, status);
    dispatchOrdersUpdated();

    return updatedOrder || updateLocalOrderStatus(orderId, status);
  } catch (error) {
    console.warn("Could not update Supabase order status. Falling back to local order:", error);
    return updateLocalOrderStatus(orderId, status);
  }
}

export async function markOrderReadyForPickup(orderId) {
  const updatedOrder = await updateOrderStatus(orderId, WAITING_FOR_PICKUP_STATUS);

  if (updatedOrder) {
    emitOrderReadyForPickup(updatedOrder);
  }

  return updatedOrder;
}

export async function markOrderPickedUp(orderId) {
  return updateOrderStatus(orderId, ARCHIVED_ORDER_STATUS);
}

export function useOrders({ realtime = false, onRealtimeNewOrder } = {}) {
  const [orders, setOrders] = useState(() => (isSupabaseConfigured ? [] : getOrders()));
  const [loading, setLoading] = useState(Boolean(isSupabaseConfigured));
  const knownOrderIdsRef = useRef(new Set());
  const refreshTimeoutRef = useRef(null);

  const refreshOrders = useCallback(async () => {
    setLoading(true);

    try {
      setOrders(await fetchOrders());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOrders();

    function handleOrdersUpdate() {
      refreshOrders();
    }

    window.addEventListener("storage", handleOrdersUpdate);
    window.addEventListener(ORDERS_UPDATED_EVENT, handleOrdersUpdate);

    return () => {
      window.removeEventListener("storage", handleOrdersUpdate);
      window.removeEventListener(ORDERS_UPDATED_EVENT, handleOrdersUpdate);
    };
  }, [refreshOrders]);

  useEffect(() => {
    orders.forEach((order) => {
      knownOrderIdsRef.current.add(order.id);
    });
  }, [orders]);

  useEffect(() => {
    if (!realtime || !isSupabaseConfigured || !supabase) {
      return undefined;
    }

    function scheduleRefresh(delay = 350) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = window.setTimeout(() => {
        refreshOrders();
      }, delay);
    }

    const channel = supabase
      .channel("admin-orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const orderId = payload.new?.id;
            const status = payload.new?.status;
            const isKnownOrder = orderId ? knownOrderIdsRef.current.has(orderId) : true;

            if (orderId) {
              knownOrderIdsRef.current.add(orderId);
            }

            if (orderId && !isKnownOrder && ACTIVE_ORDER_STATUSES.includes(status)) {
              onRealtimeNewOrder?.(orderId);
            }

            scheduleRefresh(750);
            return;
          }

          scheduleRefresh(150);
        }
      )
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [onRealtimeNewOrder, realtime, refreshOrders]);

  const updateStatus = useCallback(
    async (orderId, status) => {
      const updatedOrder = await updateOrderStatus(orderId, status);
      await refreshOrders();

      return updatedOrder;
    },
    [refreshOrders]
  );

  const markReady = useCallback(
    async (orderId) => {
      const updatedOrder = await markOrderReadyForPickup(orderId);
      await refreshOrders();

      return updatedOrder;
    },
    [refreshOrders]
  );

  const markPickedUp = useCallback(
    async (orderId) => {
      const updatedOrder = await markOrderPickedUp(orderId);
      await refreshOrders();

      return updatedOrder;
    },
    [refreshOrders]
  );

  return useMemo(
    () => ({
      orders,
      loading,
      refreshOrders,
      activeOrders: orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status)),
      waitingForPickupOrders: orders.filter((order) => order.status === WAITING_FOR_PICKUP_STATUS),
      openOrders: orders.filter((order) => OPEN_ORDER_STATUSES.includes(order.status)),
      archivedOrders: orders.filter((order) => order.status === ARCHIVED_ORDER_STATUS),
      completedOrders: orders.filter((order) => order.status === ARCHIVED_ORDER_STATUS),
      newOrders: orders.filter((order) => order.status === "New"),
      markReady,
      markPickedUp,
      updateStatus,
    }),
    [loading, markPickedUp, markReady, orders, refreshOrders, updateStatus]
  );
}

export function useOrder(orderId) {
  const [order, setOrder] = useState(() => getOrderById(orderId));
  const [loading, setLoading] = useState(Boolean(orderId && isSupabaseConfigured));

  useEffect(() => {
    let isMounted = true;

    async function loadOrder() {
      if (!orderId) {
        setOrder(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const nextOrder = await fetchOrderById(orderId);

        if (isMounted) {
          setOrder(nextOrder);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  return { order, loading };
}

export function useCustomerOrders(customerId) {
  const { orders, loading, refreshOrders } = useOrders();

  return {
    orders: orders.filter((order) => order.customerId && order.customerId === customerId),
    loading,
    refreshOrders,
  };
}
