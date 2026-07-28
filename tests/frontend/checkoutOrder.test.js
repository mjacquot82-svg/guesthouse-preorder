import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPendingOrderRequest,
  clearOrderSubmission,
  createSubmissionGate,
  getOrderErrorMessage,
  prepareOrderSubmission,
  resolvePickupTimestamp,
} from "../../src/services/checkoutOrder.js";
import { OrderApiError } from "../../src/services/orderApi.js";

function resolvedLine() {
  return {
    name: "Latte",
    productBackendId: "101",
    quantity: 2,
    options: [
      { backendId: "201", variantId: "201", name: "Large" },
      { backendId: "301", name: "Oat" },
      { backendId: "302", name: "Vanilla" },
    ],
  };
}

function createSessionStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("buildPendingOrderRequest maps cart snapshots without client prices", () => {
  const request = buildPendingOrderRequest({
    contact: {
      name: "  Jessie Guest ",
      email: " jessie@example.com ",
      phone: " +15551234567 ",
    },
    idempotencyKey: "stable-request-key",
    lines: [resolvedLine()],
    notes: "  Extra hot ",
    requestedPickupAt: "2026-07-28T12:30:00.000Z",
  });

  assert.deepEqual(request, {
    idempotency_key: "stable-request-key",
    customer: {
      name: "Jessie Guest",
      email: "jessie@example.com",
      phone: "+15551234567",
    },
    requested_pickup_at: "2026-07-28T12:30:00.000Z",
    notes: "Extra hot",
    lines: [
      {
        product_id: 101,
        variant_id: 201,
        modifier_option_ids: [301, 302],
        quantity: 2,
      },
    ],
  });
  assert.equal("price_cents" in request.lines[0], false);
});

test("resolvePickupTimestamp maps quick and custom pickup selections", () => {
  const now = new Date("2026-07-28T12:01:30.000Z");

  assert.equal(
    resolvePickupTimestamp({
      pickupTime: "asap",
      customPickupTime: "08:30",
      quickPickupMinutes: 15,
      now,
    }),
    "2026-07-28T12:20:00.000Z"
  );

  const custom = resolvePickupTimestamp({
    pickupTime: "custom",
    customPickupTime: "14:35",
    quickPickupMinutes: 15,
    now,
  });
  const customDate = new Date(custom);
  assert.equal(customDate.getHours(), 14);
  assert.equal(customDate.getMinutes(), 35);
  assert.equal(customDate.getSeconds(), 0);
});

test("buildPendingOrderRequest rejects missing opaque identifiers", () => {
  assert.throws(
    () =>
      buildPendingOrderRequest({
        contact: { name: "Guest", email: "guest@example.com", phone: "5551234" },
        idempotencyKey: "request-key",
        lines: [{ ...resolvedLine(), productBackendId: null }],
        notes: "",
        requestedPickupAt: "2026-07-28T12:30:00.000Z",
      }),
    /product is unavailable/
  );
});

test("getOrderErrorMessage translates stable API codes for customers", () => {
  assert.match(
    getOrderErrorMessage(
      new OrderApiError("internal", {
        code: "modifier_option_invalid",
        status: 422,
      })
    ),
    /customization has changed/
  );
  assert.equal(
    getOrderErrorMessage(
      new OrderApiError("Pickup time is outside business hours.", {
        code: "pickup_invalid",
        status: 422,
      })
    ),
    "Pickup time is outside business hours."
  );
  assert.match(getOrderErrorMessage(new TypeError("network")), /connection/);
});

test("submission gate freezes rapid interaction until the request settles", () => {
  const gate = createSubmissionGate();
  const cart = [{ quantity: 1 }];
  const submittedSnapshot = structuredClone(cart);

  assert.equal(gate.begin(), true);
  assert.equal(gate.isInFlight(), true);
  assert.equal(gate.begin(), false);

  if (!gate.isInFlight()) {
    cart[0].quantity = 2;
  }
  assert.deepEqual(submittedSnapshot, [{ quantity: 1 }]);
  assert.deepEqual(cart, [{ quantity: 1 }]);

  gate.end();
  assert.equal(gate.isInFlight(), false);
});

test("ambiguous failure and remount reuse the persisted idempotency key", async () => {
  const storage = createSessionStorage();
  const payload = buildPendingOrderRequest({
    contact: {
      name: "Jessie Guest",
      email: "jessie@example.com",
      phone: "+15551234567",
    },
    idempotencyKey: "",
    lines: [resolvedLine()],
    notes: "Extra hot",
    requestedPickupAt: "2026-07-28T12:30:00.000Z",
  });

  const fingerprintPayload = {
    ...payload,
    requested_pickup_at: {
      business_date: "2026-07-28",
      custom_time: null,
      selection: "asap",
    },
  };
  const firstMountSubmission = await prepareOrderSubmission(
    payload,
    { fingerprintPayload, storage }
  );
  const remountedSubmission = await prepareOrderSubmission(
    {
      ...structuredClone(payload),
      requested_pickup_at: "2026-07-28T12:35:00.000Z",
    },
    { fingerprintPayload: structuredClone(fingerprintPayload), storage }
  );

  assert.equal(
    remountedSubmission.idempotency_key,
    firstMountSubmission.idempotency_key
  );
  assert.equal(
    remountedSubmission.requested_pickup_at,
    firstMountSubmission.requested_pickup_at
  );
  assert.equal(Object.isFrozen(firstMountSubmission), true);
  assert.equal(Object.isFrozen(firstMountSubmission.lines[0]), true);
});

test("changed checkout after remount receives a new idempotency key", async () => {
  const storage = createSessionStorage();
  const payload = buildPendingOrderRequest({
    contact: {
      name: "Jessie Guest",
      email: "jessie@example.com",
      phone: "+15551234567",
    },
    idempotencyKey: "",
    lines: [resolvedLine()],
    notes: "",
    requestedPickupAt: "2026-07-28T12:30:00.000Z",
  });
  const first = await prepareOrderSubmission(payload, { storage });
  const changed = await prepareOrderSubmission(
    { ...payload, notes: "Changed after remount" },
    { storage }
  );

  assert.notEqual(changed.idempotency_key, first.idempotency_key);

  clearOrderSubmission(storage);
  const afterReset = await prepareOrderSubmission(payload, { storage });
  assert.notEqual(afterReset.idempotency_key, first.idempotency_key);
});
