import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

export const ORDER_STATUSES = ["New", "Preparing", "Ready for Pickup", "Completed", "Cancelled"];

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function throwIfError(error, context) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

function createOrderId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeOrderItem(item) {
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

export function normalizeOrder(order) {
  const items = Array.isArray(order.items) ? order.items.map(normalizeOrderItem) : [];
  const subtotal = Number(order.subtotal ?? items.reduce((sum, item) => sum + item.totalPrice, 0)) || 0;

  return {
    id: order.id || createOrderId(),
    customerId: order.customerId || "",
    customerName: order.customerName || "",
    customerEmail: order.customerEmail || "",
    customerPhone: order.customerPhone || "",
    createdAt: order.createdAt || new Date().toISOString(),
    updatedAt: order.updatedAt || "",
    status: ORDER_STATUSES.includes(order.status) ? order.status : "New",
    subtotal,
    total: Number(order.total ?? subtotal) || 0,
    notes: order.notes || "",
    pickupSummary: order.pickupSummary || "",
    items,
  };
}

export function buildOrderFromCheckout({ cart, customer, contact, notes, pickupSummary }) {
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

  return normalizeOrder({
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
}

function toOrderRow(order) {
  return {
    id: order.id,
    customer_id: order.customerId || null,
    customer_name: order.customerName || "",
    customer_email: String(order.customerEmail || "").trim().toLowerCase(),
    customer_phone: order.customerPhone || "",
    status: order.status,
    subtotal: Number(order.subtotal) || 0,
    total: Number(order.total) || 0,
    notes: order.notes || "",
    pickup_summary: order.pickupSummary || "",
    source: "web",
    created_at: order.createdAt,
  };
}

function toOrderItemRow(orderId, item, index = 0) {
  return {
    order_id: orderId,
    line_key: item.id || "",
    product_id: item.productId || null,
    variant_id: item.variantId || null,
    product_name: item.productName,
    variant_name: item.variantName || "",
    category_name: item.cartItem?.category || "",
    quantity: Number(item.quantity) || 1,
    unit_price: Number(item.unitPrice) || 0,
    total_price: Number(item.totalPrice) || 0,
    base_price: item.cartItem?.basePrice ?? null,
    variant_price: item.cartItem?.variantPrice ?? null,
    cart_item: item.cartItem || {},
    sort_order: index,
  };
}

function toModifierRow(orderItemId, modifier, index = 0) {
  return {
    order_item_id: orderItemId,
    modifier_group_id: modifier.groupId || null,
    modifier_option_id: modifier.optionId || null,
    group_name: modifier.groupName || "",
    option_name: modifier.name,
    price_delta: Number(modifier.priceDelta) || 0,
    sort_order: index,
  };
}

function fromOrderRows(orderRow, itemRows = [], modifierRows = []) {
  return normalizeOrder({
    id: orderRow.id,
    customerId: orderRow.customer_id || "",
    customerName: orderRow.customer_name || "",
    customerEmail: orderRow.customer_email || "",
    customerPhone: orderRow.customer_phone || "",
    createdAt: orderRow.created_at || "",
    updatedAt: orderRow.updated_at || "",
    status: orderRow.status,
    subtotal: orderRow.subtotal,
    total: orderRow.total,
    notes: orderRow.notes || "",
    pickupSummary: orderRow.pickup_summary || "",
    items: itemRows
      .filter((item) => item.order_id === orderRow.id)
      .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
      .map((item) => ({
        id: item.line_key || item.id,
        productId: item.product_id || "",
        variantId: item.variant_id || "",
        productName: item.product_name,
        variantName: item.variant_name || "",
        selectedModifiers: modifierRows
          .filter((modifier) => modifier.order_item_id === item.id)
          .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
          .map((modifier) => ({
            groupId: modifier.modifier_group_id || "",
            groupName: modifier.group_name || "",
            optionId: modifier.modifier_option_id || "",
            name: modifier.option_name,
            priceDelta: Number(modifier.price_delta) || 0,
          })),
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        cartItem: item.cart_item || null,
      })),
  });
}

export async function fetchOrdersFromSupabase() {
  const client = requireSupabase();
  const ordersResponse = await client.from("orders").select("*").order("created_at", { ascending: false });
  throwIfError(ordersResponse.error, "Could not load orders");

  const orderRows = ordersResponse.data || [];
  const orderIds = orderRows.map((order) => order.id);

  if (!orderIds.length) {
    return [];
  }

  const itemsResponse = await client
    .from("order_items")
    .select("*")
    .in("order_id", orderIds)
    .order("sort_order");
  throwIfError(itemsResponse.error, "Could not load order items");

  const itemRows = itemsResponse.data || [];
  const itemIds = itemRows.map((item) => item.id);
  let modifierRows = [];

  if (itemIds.length) {
    const modifiersResponse = await client
      .from("order_item_modifiers")
      .select("*")
      .in("order_item_id", itemIds)
      .order("sort_order");
    throwIfError(modifiersResponse.error, "Could not load order item modifiers");
    modifierRows = modifiersResponse.data || [];
  }

  return orderRows.map((order) => fromOrderRows(order, itemRows, modifierRows));
}

export async function fetchOrderByIdFromSupabase(orderId) {
  if (!orderId) {
    return null;
  }

  const client = requireSupabase();
  const orderResponse = await client.from("orders").select("*").eq("id", orderId).maybeSingle();
  throwIfError(orderResponse.error, "Could not load order");

  if (!orderResponse.data) {
    return null;
  }

  const itemsResponse = await client
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("sort_order");
  throwIfError(itemsResponse.error, "Could not load order items");

  const itemRows = itemsResponse.data || [];
  const itemIds = itemRows.map((item) => item.id);
  let modifierRows = [];

  if (itemIds.length) {
    const modifiersResponse = await client
      .from("order_item_modifiers")
      .select("*")
      .in("order_item_id", itemIds)
      .order("sort_order");
    throwIfError(modifiersResponse.error, "Could not load order item modifiers");
    modifierRows = modifiersResponse.data || [];
  }

  return fromOrderRows(orderResponse.data, itemRows, modifierRows);
}

export async function createOrderInSupabase(order) {
  const client = requireSupabase();
  let writesComplete = false;

  try {
    const orderResponse = await client.from("orders").insert(toOrderRow(order)).select("*").single();
    throwIfError(orderResponse.error, "Could not create order");

    const itemRows = order.items.map((item, index) => toOrderItemRow(order.id, item, index));
    const itemsResponse = await client
      .from("order_items")
      .insert(itemRows)
      .select("id, order_id, line_key, sort_order");
    throwIfError(itemsResponse.error, "Could not create order items");

    const insertedItems = itemsResponse.data || [];
    const modifierRows = order.items.flatMap((item, itemIndex) => {
      const insertedItem =
        insertedItems.find((row) => row.line_key && row.line_key === item.id) ||
        insertedItems.find((row) => Number(row.sort_order) === itemIndex);

      if (!insertedItem) {
        return [];
      }

      return item.selectedModifiers.map((modifier, modifierIndex) =>
        toModifierRow(insertedItem.id, modifier, modifierIndex)
      );
    });

    if (modifierRows.length) {
      const modifiersResponse = await client.from("order_item_modifiers").insert(modifierRows);
      throwIfError(modifiersResponse.error, "Could not create order item modifiers");
    }

    writesComplete = true;

    try {
      return await fetchOrderByIdFromSupabase(order.id);
    } catch {
      return order;
    }
  } catch (error) {
    if (!writesComplete) {
      await client.from("orders").delete().eq("id", order.id);
    }

    throw error;
  }
}

export async function updateOrderStatusInSupabase(orderId, status) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select("*")
    .maybeSingle();
  throwIfError(error, "Could not update order status");

  if (!data) {
    return null;
  }

  return fetchOrderByIdFromSupabase(orderId);
}
