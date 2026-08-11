import assert from "node:assert/strict";
import { after, test } from "node:test";

import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const vite = await createServer({ appType: "custom", server: { hmr: false, middlewareMode: true } });
const [{ default: App }, { CustomerAuthProvider }, { default: AppErrorBoundary }, staffApi] = await Promise.all([
  vite.ssrLoadModule("/src/App.jsx"),
  vite.ssrLoadModule("/src/auth/CustomerAuthContext.jsx"),
  vite.ssrLoadModule("/src/components/AppErrorBoundary.jsx"),
  vite.ssrLoadModule("/src/services/staffManagementApi.js"),
]);

after(() => vite.close());

const customerSession = {
  authenticated: true,
  csrf_token: "customer-csrf",
  display_name: "Jessie Guest",
  email: "guest@example.test",
  permissions: ["customer.profile", "customer.orders"],
  role: "customer",
  user_id: "customer-1",
};

const ownerSession = {
  authenticated: true,
  csrf_token: "owner-csrf",
  display_name: "Jessie Owner",
  email: "owner@example.test",
  permissions: ["members.manage", "loyalty.manage"],
  role: "owner",
  user_id: "owner-1",
};

const catalog = {
  version: "1",
  generated_at: "2026-08-11T00:00:00Z",
  pricing: { tax_name: "HST", tax_rate_millionths: 130000 },
  categories: [{
    id: "10",
    slug: "coffee",
    name: "Coffee",
    note: "House cups.",
    sort_order: 0,
    products: [{
      id: "100",
      slug: "drip-coffee",
      name: "Drip Coffee",
      description: "Warm and steady.",
      image: "coffee",
      featured: true,
      lunch_special: false,
      base_price_cents: 375,
      sort_order: 0,
      variants: [],
      modifier_groups: [],
    }],
  }],
};

const response = (status, payload) => ({
  json: async () => payload,
  ok: status >= 200 && status < 300,
  status,
});

async function waitForText(container, text) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (container.textContent.includes(text)) return;
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
  assert.fail(`Expected rendered application to contain: ${text}\nActual: ${container.textContent}`);
}

async function renderApp({ initialPath, owner = ownerSession, session = customerSession, quickOrder = { product_ids: [] }, staff = [] }) {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", { url: `https://cafe.test${initialPath}` });
  const previous = {
    document: globalThis.document,
    fetch: globalThis.fetch,
    localStorage: globalThis.localStorage,
    navigator: globalThis.navigator,
    window: globalThis.window,
  };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  dom.window.localStorage.setItem("cafe-cart", JSON.stringify({ legacy: true }));
  globalThis.fetch = async (url) => {
    const path = new URL(String(url), "https://cafe.test").pathname;
    if (path === "/api/v1/customer/auth/session") return response(session ? 200 : 401, session || { detail: { code: "authentication_required" } });
    if (path === "/api/v1/catalog") return response(200, catalog);
    if (path === "/api/v1/customer/profile") return response(200, { email: "guest@example.test", name: "Jessie Guest", phone: "+15198816869", preferred_pickup_minutes: null, preferred_pickup_notes: "" });
    if (path === "/api/v1/customer/quick-order") {
      if (quickOrder === "pending") return new Promise(() => {});
      if (quickOrder instanceof Error) throw quickOrder;
      return response(200, quickOrder);
    }
    if (path === "/api/v1/customer/loyalty") return response(200, { programs: [] });
    if (path === "/api/v1/customer/push/config") return response(200, { enrollment_enabled: false });
    if (path === "/api/v1/customer/push/status") return response(200, { active_device_count: 0, lunch_special_enabled: false });
    if (path === "/api/v1/owner/auth/session") return response(200, owner);
    if (path === "/api/v1/owner/loyalty") return response(503, { detail: { message: "Loyalty is temporarily unavailable." } });
    if (path === "/api/v1/owner/staff") {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return response(200, staff);
    }
    if (path.startsWith("/api/v1/owner/")) return response(503, { detail: { message: "Not needed by this test." } });
    throw new Error(`Unexpected request: ${path}`);
  };

  const container = document.getElementById("root");
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      React.createElement(CustomerAuthProvider, null, React.createElement(App)),
    ));
  });
  return {
    container,
    dom,
    previous,
    root,
    async cleanup() {
      await act(async () => root.unmount());
      dom.window.close();
      globalThis.window = previous.window;
      globalThis.document = previous.document;
      globalThis.fetch = previous.fetch;
      globalThis.localStorage = previous.localStorage;
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: previous.navigator });
    },
  };
}

test("signed-in Account to Home navigation survives account cleanup and legacy PWA cart data", { concurrency: false }, async () => {
  const app = await renderApp({ initialPath: "/account", quickOrder: { product_ids: [100] } });
  try {
    await waitForText(app.container, "Account");
    const home = [...app.container.querySelectorAll("a")].find((link) => link.textContent.trim() === "Home");
    assert.ok(home);
    await act(async () => home.dispatchEvent(new app.dom.window.MouseEvent("click", { bubbles: true, cancelable: true })));
    assert.equal(app.container.querySelector('.ladels-hero-logo')?.getAttribute('src'), "/ladels.png");
    await waitForText(app.container, "Based on what you order most");
    assert.ok(app.container.querySelector(".home-page"), "Home rendered a nonblank page");
  } finally {
    await app.cleanup();
  }
});

for (const [name, session, quickOrder] of [
  ["while personalization is loading", customerSession, "pending"],
  ["signed-in personalization with no history", customerSession, { product_ids: [] }],
  ["signed-in personalization failure", customerSession, new Error("offline")],
  ["signed-out fallback", null, { product_ids: [] }],
]) {
  test(`Home renders ${name}`, { concurrency: false }, async () => {
    const app = await renderApp({ initialPath: "/", session, quickOrder });
    try {
      await waitForText(app.container, "Quick Order");
      assert.equal(app.container.querySelector('.ladels-hero-logo')?.getAttribute('alt'), "Ladel's Wellness Café");
      assert.ok(app.container.querySelector(".home-page"));
      const genericCard = app.container.querySelector("a.quick-product-card");
      assert.ok(genericCard);
      assert.equal(genericCard.getAttribute("aria-label"), "Customize Drip Coffee");
      assert.equal(genericCard.textContent.includes("Customize on the menu"), true);
      assert.equal(genericCard.textContent.trim().endsWith("Customize"), false);
      assert.equal(genericCard.querySelector("button"), null);
    } finally {
      await app.cleanup();
    }
  });
}

test("Home keeps direct Add only on personalized exact-configuration Quick Order cards", { concurrency: false }, async () => {
  const app = await renderApp({
    initialPath: "/",
    quickOrder: {
      configurations: [{ modifiers: [], product_id: "100", unit_price_cents: 375, variant_id: null }],
      product_ids: ["100"],
    },
  });
  try {
    await waitForText(app.container, "Quick Order");
    const exactCard = app.container.querySelector("article.quick-product-card");
    assert.ok(exactCard);
    assert.ok(exactCard.querySelector('button[aria-label="Quick add Drip Coffee"]'));
    assert.equal(exactCard.querySelector('a[aria-label="Customize Drip Coffee"]'), null);
  } finally {
    await app.cleanup();
  }
});

test("Owner Operations to Staff renders loading and API success without an effect cleanup crash", { concurrency: false }, async () => {
  const app = await renderApp({ initialPath: "/admin", staff: [{ id: "staff-1", display_name: "Morning Barista", active: true }] });
  try {
    await waitForText(app.container, "Operations Portal");
    const staff = [...app.container.querySelectorAll("a")].find((link) => link.textContent.trim() === "Staff");
    assert.ok(staff, "Owner members.manage capability exposes Staff navigation");
    await act(async () => staff.dispatchEvent(new app.dom.window.MouseEvent("click", { bubbles: true, cancelable: true })));
    await waitForText(app.container, "Loading Staff access accounts…");
    await waitForText(app.container, "Morning Barista");
    assert.ok(app.container.querySelector(".staff-access-grid"));
  } finally {
    await app.cleanup();
  }
});

test("Staff API failure renders an intentional error instead of a blank route", { concurrency: false }, async () => {
  const app = await renderApp({ initialPath: "/admin/staff", staff: null });
  try {
    await waitForText(app.container, "Staff access returned an invalid response.");
    assert.ok(app.container.querySelector("[role=alert]"));
    assert.ok(app.container.querySelector(".staff-access-grid"));
  } finally {
    await app.cleanup();
  }
});

test("Staff authorization denial redirects to an intentional Operations page", { concurrency: false }, async () => {
  const app = await renderApp({
    initialPath: "/admin/staff",
    owner: { ...ownerSession, permissions: [], role: "manager" },
  });
  try {
    await waitForText(app.container, "Operations Portal");
    assert.notEqual(app.container.textContent.trim(), "");
    assert.equal([...app.container.querySelectorAll("a")].some((link) => link.textContent.trim() === "Staff"), false);
  } finally {
    await app.cleanup();
  }
});

test("Owner Loyalty and Staff routes can navigate in both directions without cleanup exceptions", { concurrency: false }, async () => {
  const app = await renderApp({ initialPath: "/admin/loyalty", staff: [] });
  try {
    await waitForText(app.container, "Loyalty is temporarily unavailable.");
    let destination = [...app.container.querySelectorAll("a")].find((link) => link.textContent.trim() === "Staff");
    await act(async () => destination.dispatchEvent(new app.dom.window.MouseEvent("click", { bubbles: true, cancelable: true })));
    await waitForText(app.container, "Staff access accounts");
    destination = [...app.container.querySelectorAll("a")].find((link) => link.textContent.trim() === "Loyalty");
    await act(async () => destination.dispatchEvent(new app.dom.window.MouseEvent("click", { bubbles: true, cancelable: true })));
    await waitForText(app.container, "Loyalty is temporarily unavailable.");
    assert.notEqual(app.container.textContent.trim(), "");
  } finally {
    await app.cleanup();
  }
});

test("unexpected child exceptions render the recoverable application fallback", { concurrency: false }, async () => {
  const dom = new JSDOM("<div id=\"root\"></div>", { url: "https://cafe.test/" });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  const root = createRoot(document.getElementById("root"));
  const originalError = console.error;
  console.error = () => {};
  function BrokenPage() { throw new Error("test render failure"); }
  try {
    await act(async () => root.render(React.createElement(AppErrorBoundary, null, React.createElement(BrokenPage))));
    assert.match(document.body.textContent, /Something went wrong/);
    assert.match(document.body.textContent, /Try again/);
    assert.match(document.body.textContent, /Reload/);
  } finally {
    console.error = originalError;
    await act(async () => root.unmount());
    dom.window.close();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});

test("Staff API rejects malformed success payloads", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => response(200, { accounts: [] });
  try {
    await assert.rejects(() => staffApi.fetchStaffAccounts(), /invalid response/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
