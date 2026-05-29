import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

const ACTIVE_REVENUE_STATUSES = ["New", "Preparing", "Ready for Pickup", "Completed"];
const DRINK_CATEGORY_KEYS = ["coffee", "tea", "cold-drinks", "cold drinks", "drink", "drinks"];
const FOOD_CATEGORY_KEYS = ["pastries", "pastry", "sandwiches", "sandwich", "snacks", "snack", "food", "bakery"];

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

function startOfToday(now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(now = new Date()) {
  const date = startOfToday(now);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function startOfMonth(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getAnalyticsRanges(now = new Date()) {
  return {
    today: startOfToday(now),
    week: startOfWeek(now),
    month: startOfMonth(now),
    now,
  };
}

function cents(value) {
  return Math.round((Number(value) || 0) * 100);
}

function dollars(valueInCents) {
  return valueInCents / 100;
}

function normalizeCategory(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getItemCategory(item) {
  return normalizeCategory(item.category_name || item.cart_item?.category);
}

function getItemName(item) {
  const variantName = String(item.variant_name || "").trim();
  const productName = String(item.product_name || "").trim() || "Cafe item";

  return variantName ? `${variantName} ${productName}` : productName;
}

function isDailySpecialItem(item) {
  return item.cart_item?.source === "daily_special" || Boolean(item.cart_item?.specialId);
}

function itemMatchesCategory(item, categoryKeys) {
  const category = getItemCategory(item);

  return categoryKeys.some((key) => category === key || category.includes(key));
}

function addPopularItem(bucket, name, quantity) {
  const key = name.trim().toLowerCase();

  if (!key) {
    return;
  }

  const existing = bucket.get(key) || { name, quantity: 0 };
  existing.quantity += Number(quantity) || 0;
  bucket.set(key, existing);
}

function getTopPopularItem(bucket) {
  return [...bucket.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))[0] || null;
}

function countOrdersSince(orders, startDate) {
  return orders.filter((order) => new Date(order.created_at) >= startDate).length;
}

function sumRevenueSince(orders, startDate) {
  return dollars(
    orders.reduce((total, order) => {
      if (new Date(order.created_at) < startDate) {
        return total;
      }

      return total + cents(order.total);
    }, 0)
  );
}

function getAverageOrdersPerDay(orders, monthStart, now) {
  const elapsedDays = Math.max(1, Math.floor((startOfToday(now) - monthStart) / 86400000) + 1);
  return orders.length / elapsedDays;
}

function mapRecentOrder(order) {
  return {
    id: order.id,
    customerName: order.customer_name || "Walk-in customer",
    total: Number(order.total) || 0,
    pickupTime: order.pickup_summary || "Pickup time not set",
    createdAt: order.created_at,
  };
}

function buildPopularItems(orderItems, dailySpecials) {
  const drinkItems = new Map();
  const foodItems = new Map();
  const dailySpecialItems = new Map();
  const specialTitleById = new Map(dailySpecials.map((special) => [special.id, special.title]));

  orderItems.forEach((item) => {
    const quantity = Number(item.quantity) || 0;

    if (isDailySpecialItem(item)) {
      const specialId = item.cart_item?.specialId;
      const name = specialTitleById.get(specialId) || item.product_name || "Daily special";
      addPopularItem(dailySpecialItems, name, quantity);
      return;
    }

    if (itemMatchesCategory(item, DRINK_CATEGORY_KEYS)) {
      addPopularItem(drinkItems, getItemName(item), quantity);
      return;
    }

    if (itemMatchesCategory(item, FOOD_CATEGORY_KEYS)) {
      addPopularItem(foodItems, getItemName(item), quantity);
    }
  });

  return {
    drink: getTopPopularItem(drinkItems),
    food: getTopPopularItem(foodItems),
    dailySpecial: getTopPopularItem(dailySpecialItems),
  };
}

async function fetchOrderCount(client, startDate) {
  const { count, error } = await client
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", ACTIVE_REVENUE_STATUSES)
    .gte("created_at", startDate.toISOString());

  throwIfError(error, "Could not count orders");
  return count || 0;
}

export async function fetchAdminAnalytics({ now = new Date() } = {}) {
  const client = requireSupabase();
  const ranges = getAnalyticsRanges(now);

  const [ordersToday, ordersThisWeek, ordersThisMonth, monthOrdersResponse, recentOrdersResponse, itemResponse, specialsResponse] =
    await Promise.all([
      fetchOrderCount(client, ranges.today),
      fetchOrderCount(client, ranges.week),
      fetchOrderCount(client, ranges.month),
      client
        .from("orders")
        .select("id, total, created_at")
        .in("status", ACTIVE_REVENUE_STATUSES)
        .gte("created_at", ranges.month.toISOString())
        .order("created_at", { ascending: false }),
      client
        .from("orders")
        .select("id, customer_name, total, pickup_summary, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
      client
        .from("order_items")
        .select("product_name, variant_name, category_name, quantity, cart_item, created_at")
        .gte("created_at", ranges.month.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000),
      client.from("daily_specials").select("id, title"),
    ]);

  throwIfError(monthOrdersResponse.error, "Could not load monthly order totals");
  throwIfError(recentOrdersResponse.error, "Could not load recent orders");
  throwIfError(itemResponse.error, "Could not load popular items");
  throwIfError(specialsResponse.error, "Could not load daily specials");

  const monthOrders = monthOrdersResponse.data || [];
  const monthRevenue = sumRevenueSince(monthOrders, ranges.month);

  return {
    generatedAt: now.toISOString(),
    orders: {
      today: ordersToday,
      week: ordersThisWeek,
      month: ordersThisMonth,
    },
    revenue: {
      today: sumRevenueSince(monthOrders, ranges.today),
      week: sumRevenueSince(monthOrders, ranges.week),
      month: monthRevenue,
    },
    averages: {
      orderValue: monthOrders.length ? monthRevenue / monthOrders.length : 0,
      ordersPerDay: getAverageOrdersPerDay(monthOrders, ranges.month, now),
    },
    popularItems: buildPopularItems(itemResponse.data || [], specialsResponse.data || []),
    recentOrders: (recentOrdersResponse.data || []).map(mapRecentOrder),
  };
}
