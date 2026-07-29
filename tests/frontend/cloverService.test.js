import assert from "node:assert/strict";
import test from "node:test";

import {
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

test("getCloverConnectUrl supports a separately hosted API", () => {
  assert.equal(
    getCloverConnectUrl("https://api.example.test/"),
    "https://api.example.test/api/v1/clover/oauth/start"
  );
});
