import assert from "node:assert/strict";
import test from "node:test";

import {
  archiveOwnerProduct,
  fetchOwnerCatalog,
  updateOwnerProductAvailability,
  updateOwnerProduct,
} from "../../src/services/ownerCatalogApi.js";

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

test("owner catalog reads through the credentialed production API", async () => {
  let request;
  const payload = { categories: [], modifier_groups: [], products: [] };
  const result = await fetchOwnerCatalog({
    apiBaseUrl: "https://api.example.test/",
    fetchImpl: async (...args) => {
      request = args;
      return jsonResponse(200, payload);
    },
  });
  assert.deepEqual(result, payload);
  assert.equal(request[0], "https://api.example.test/api/v1/owner/catalog");
  assert.equal(request[1].credentials, "include");
});

test("owner product writes use session CSRF and archive instead of hard delete", async () => {
  const calls = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    return args[1].method === "DELETE"
      ? { ok: true, status: 204 }
      : jsonResponse(200, { id: "42" });
  };
  await updateOwnerProduct("42", { name: "Generic product" }, "csrf", { fetchImpl });
  await archiveOwnerProduct("42", "csrf", { fetchImpl });

  assert.equal(calls[0][0], "/api/v1/owner/catalog/products/42");
  assert.equal(calls[0][1].method, "PUT");
  assert.equal(calls[0][1].headers["X-CSRF-Token"], "csrf");
  assert.equal(calls[1][1].method, "DELETE");
  assert.equal(calls[1][1].credentials, "include");
});

test("owner availability writes use the narrow CSRF-protected endpoint", async () => {
  let request;
  await updateOwnerProductAvailability("42", false, "csrf", {
    fetchImpl: async (...args) => {
      request = args;
      return jsonResponse(200, { id: "42", available: false });
    },
  });

  assert.equal(request[0], "/api/v1/owner/catalog/products/42/availability");
  assert.equal(request[1].method, "PATCH");
  assert.equal(request[1].credentials, "include");
  assert.equal(request[1].headers["X-CSRF-Token"], "csrf");
  assert.deepEqual(JSON.parse(request[1].body), { available: false });
});
