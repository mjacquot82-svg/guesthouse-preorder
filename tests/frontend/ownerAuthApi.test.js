import assert from "node:assert/strict";
import test from "node:test";

import {
  OwnerAuthError,
  fetchOwnerSession,
  loginOwner,
  logoutOwner,
} from "../../src/services/ownerAuthApi.js";

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

test("owner session uses only the credentialed JDS BFF", async () => {
  const calls = [];
  const session = { csrf_token: "csrf", role: "owner" };
  const result = await fetchOwnerSession({
    apiBaseUrl: "https://api.example.test/",
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse(200, session);
    },
  });

  assert.deepEqual(result, session);
  assert.equal(calls[0][0], "https://api.example.test/api/v1/owner/auth/session");
  assert.equal(calls[0][1].credentials, "include");
  assert.equal(calls[0][1].method, "GET");
});

test("owner login sends credentials to the BFF without browser token storage", async () => {
  let request;
  await loginOwner("owner@example.com", "correct horse battery staple", {
    fetchImpl: async (...args) => {
      request = args;
      return jsonResponse(200, { csrf_token: "csrf", role: "owner" });
    },
  });

  assert.equal(request[0], "/api/v1/owner/auth/login");
  assert.equal(request[1].credentials, "include");
  assert.deepEqual(JSON.parse(request[1].body), {
    email: "owner@example.com",
    password: "correct horse battery staple",
  });
});

test("owner logout supplies the session CSRF token and normalizes 401 errors", async () => {
  let logoutRequest;
  await logoutOwner("csrf-token", {
    fetchImpl: async (...args) => {
      logoutRequest = args;
      return jsonResponse(200, { message: "Signed out." });
    },
  });
  assert.equal(logoutRequest[1].headers["X-CSRF-Token"], "csrf-token");
  assert.equal(logoutRequest[1].credentials, "include");

  await assert.rejects(
    fetchOwnerSession({
      fetchImpl: async () => jsonResponse(401, {
        detail: { code: "session_expired", message: "The owner session is invalid or expired." },
      }),
    }),
    (error) => error instanceof OwnerAuthError && error.status === 401 && error.code === "session_expired"
  );
});
