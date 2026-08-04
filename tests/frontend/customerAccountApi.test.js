import assert from "node:assert/strict";
import test from "node:test";

import { fetchCustomerProfile } from "../../src/services/customerAccountApi.js";

test("customer profile hydration bypasses stale browser caches", async () => {
  let request;
  const profile = {
    email: "customer@example.com",
    name: "Customer Name",
    phone: "+15198816869",
  };

  const result = await fetchCustomerProfile({
    fetchImpl: async (...args) => {
      request = args;
      return { json: async () => profile, ok: true, status: 200 };
    },
  });

  assert.equal(request[0], "/api/v1/customer/profile");
  assert.equal(request[1].cache, "no-store");
  assert.equal(request[1].credentials, "include");
  assert.deepEqual(result, profile);
});
