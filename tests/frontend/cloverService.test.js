import assert from "node:assert/strict";
import test from "node:test";

import {
  CloverCheckoutError,
  createCloverCheckout,
  getCloverConnectUrl,
} from "../../src/services/cloverService.js";

test("createCloverCheckout requests the server-owned checkout endpoint", async () => {
  let request;
  const checkout = await createCloverCheckout("token/with spaces", {
    apiBaseUrl: "https://api.example.test/",
    fetchImpl: async (...args) => {
      request = args;
      return {
        ok: true,
        json: async () => ({
          checkout_url: "https://checkout.clover.test/session",
          checkout_session_id: "session-id",
        }),
      };
    },
  });

  assert.equal(
    request[0],
    "https://api.example.test/api/v1/clover/orders/token%2Fwith%20spaces/checkout"
  );
  assert.equal(request[1].method, "POST");
  assert.equal(checkout.checkout_session_id, "session-id");
});

test("checkout surfaces the backend message when an order was already saved", async () => {
  await assert.rejects(
    createCloverCheckout("saved-order", {
      fetchImpl: async () => ({
        ok: false,
        status: 502,
        json: async () => ({
          detail: {
            code: "clover_rejected_request",
            message: "Your order was saved, but secure payment could not be started. Please try payment again.",
          },
        }),
      }),
    }),
    (error) => {
      assert.ok(error instanceof CloverCheckoutError);
      assert.equal(error.code, "clover_rejected_request");
      assert.equal(error.status, 502);
      assert.match(error.message, /order was saved/);
      assert.doesNotMatch(error.message, /check your connection/i);
      return true;
    },
  );
});

test("checkout mentions the customer connection only for a real fetch failure", async () => {
  await assert.rejects(
    createCloverCheckout("saved-order", {
      fetchImpl: async () => { throw new TypeError("offline"); },
    }),
    (error) => {
      assert.ok(error instanceof CloverCheckoutError);
      assert.equal(error.code, "network_error");
      assert.match(error.message, /check your connection/i);
      assert.match(error.message, /order was saved/i);
      return true;
    },
  );
});

test("getCloverConnectUrl supports a separately hosted API", () => {
  assert.equal(
    getCloverConnectUrl("https://api.example.test/"),
    "https://api.example.test/api/v1/clover/oauth/start"
  );
});
