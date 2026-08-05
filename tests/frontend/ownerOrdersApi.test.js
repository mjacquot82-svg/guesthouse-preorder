import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  fetchActiveOwnerOrders,
  fetchOwnerOrderHistory,
  fetchOwnerOrderSummary,
  updateOwnerOrderFulfillment,
} from "../../src/services/ownerOrdersApi.js";
import { pickupTiming, summarizeOwnerOrders } from "../../src/services/ownerOrderPresentation.js";

function response(status, payload) {
  return { ok: status >= 200 && status < 300, status, async json() { return payload; } };
}

test("owner order reads use the authenticated session", async () => {
  const calls = [];
  const fetchImpl = async (...args) => { calls.push(args); return response(200, []); };
  await fetchActiveOwnerOrders({ apiBaseUrl: "https://api.test/", fetchImpl });
  await fetchOwnerOrderHistory({ apiBaseUrl: "https://api.test/", fetchImpl });
  await fetchOwnerOrderSummary({ apiBaseUrl: "https://api.test/", fetchImpl });
  assert.deepEqual(calls.map((call) => call[0]), [
    "https://api.test/api/v1/owner/orders/active",
    "https://api.test/api/v1/owner/orders/history",
    "https://api.test/api/v1/owner/orders/summary",
  ]);
  assert.ok(calls.every((call) => call[1].credentials === "include"));
});

test("fulfillment updates carry optimistic version and CSRF protection", async () => {
  let call;
  const fetchImpl = async (...args) => { call = args; return response(200, { id: 42 }); };
  await updateOwnerOrderFulfillment(42, "ready", 7, "csrf-token", { fetchImpl });
  assert.equal(call[0], "/api/v1/owner/orders/42/fulfillment");
  assert.equal(call[1].method, "PATCH");
  assert.equal(call[1].headers["X-CSRF-Token"], "csrf-token");
  assert.deepEqual(JSON.parse(call[1].body), { expected_version: 7, status: "ready" });
});

test("pickup timing and operational summaries are owner-friendly", () => {
  const now = new Date("2026-08-05T12:00:00Z");
  assert.equal(pickupTiming({ requested_pickup_at: "2026-08-05T12:12:00Z" }, now), "In 12 min");
  assert.equal(pickupTiming({ requested_pickup_at: "2026-08-05T12:00:00Z" }, now), "Due now");
  assert.equal(pickupTiming({ requested_pickup_at: "2026-08-05T11:52:00Z" }, now), "8 min overdue");
  assert.deepEqual(summarizeOwnerOrders([
    { payment_status: "paid", fulfillment_status: "new" },
    { payment_status: "paid", fulfillment_status: "ready" },
    { payment_status: "payment_pending", fulfillment_status: "new" },
    { payment_status: "payment_failed", fulfillment_status: "new" },
  ]), { failed: 1, new: 1, preparing: 0, ready: 1, waiting: 1 });
});

test("Owner Orders provides complete operational states and refresh safeguards", async () => {
  const page = await readFile(new URL("../../src/admin/OrdersPage.jsx", import.meta.url), "utf8");
  assert.match(page, /owner-order-skeletons/);
  assert.match(page, /No active orders/);
  assert.match(page, /Orders may be out of date/);
  assert.match(page, /window\.setInterval/);
  assert.match(page, /window\.addEventListener\("focus"/);
  assert.match(page, /Do not prepare—payment is not complete/);
  assert.match(page, /Start Preparing/);
  assert.match(page, /Mark Ready/);
  assert.match(page, /Complete Order/);
  assert.match(page, /showModal\(\)/);
  assert.match(page, /<dialog/);
  assert.match(page, /disabled=\{busy/);
});

test("dashboard uses real order metrics with honest loading and error states", async () => {
  const dashboard = await readFile(new URL("../../src/admin/AdminDashboard.jsx", import.meta.url), "utf8");
  assert.match(dashboard, /fetchOwnerOrderSummary/);
  assert.match(dashboard, /Today’s paid pickups/);
  assert.match(dashboard, /Loading today’s queue/);
  assert.match(dashboard, /Unavailable/);
  assert.doesNotMatch(dashboard, /Awaiting live queue|Pending payment integration/);
});
