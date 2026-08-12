import assert from "node:assert/strict";
import { after, test } from "node:test";

import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createServer } from "vite";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const vite = await createServer({ appType: "custom", server: { hmr: false, middlewareMode: true } });
const [{ OwnerAuthProvider }, { default: RequireOwner }, { default: CommunicationsPage, hasLunchSpecialAnnouncementToday }] = await Promise.all([
  vite.ssrLoadModule("/src/auth/OwnerAuthContext.jsx"),
  vite.ssrLoadModule("/src/auth/RequireOwner.jsx"),
  vite.ssrLoadModule("/src/admin/CommunicationsPage.jsx"),
]);

after(() => vite.close());

const response = (status, payload) => ({ json: async () => payload, ok: status >= 200 && status < 300, status });
const today = "2026-08-12T15:00:00.000Z";
const ordinaryActivity = { accepted: 0, attempted: 4, expired: 0, failed: 1, id: "original", kind: "lunch_special", message: "Lunch", occurred_at: today, sent_by: "Staff", status: "completed", suppressed: 0, title: "Today’s Lunch Special" };
const snapshot = (activity = []) => ({
  activity,
  health: [{ actionable: false, detail: "Ready", key: "push", name: "Push notifications", status: "ready" }],
  lunch_special: { customer_visible: true, description: "", id: "1", image: "", name: "Soup", orderable: true, price_cents: 1295, warnings: [] },
  summary: { actionable_warnings: 0, push_release_enabled: true },
});

async function waitForText(container, text) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (container.textContent.includes(text)) return;
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
  assert.fail(`Expected UI text: ${text}\nActual: ${container.textContent}`);
}

async function renderCommunications({ activity = [], confirm = () => true, role = "owner" } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "https://cafe.test/admin/communications" });
  const previous = { document: globalThis.document, fetch: globalThis.fetch, navigator: globalThis.navigator, window: globalThis.window };
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  dom.window.confirm = confirm;
  const requests = [];
  const session = { csrf_token: `${role}-csrf`, display_name: role, permissions: ["communications.announce"], role };
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(String(url), "https://cafe.test").pathname;
    if (path === "/api/v1/owner/auth/session") return response(200, session);
    if (path === "/api/v1/owner/communications" && (!options.method || options.method === "GET")) return response(200, snapshot(activity));
    if (path === "/api/v1/owner/communications/lunch-special") { requests.push(JSON.parse(options.body)); return response(202, { id: "new", status: "queued" }); }
    throw new Error(`Unexpected request: ${path}`);
  };
  const container = document.getElementById("root");
  const root = createRoot(container);
  await act(async () => root.render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/admin/communications"] },
      React.createElement(
        OwnerAuthProvider,
        null,
        React.createElement(
          Routes,
          null,
          React.createElement(
            Route,
            { element: React.createElement(RequireOwner), path: "/admin" },
            React.createElement(Route, { element: React.createElement(CommunicationsPage), path: "communications" }),
          ),
        ),
      ),
    ),
  ));
  await waitForText(container, "Lunch Special announcement");
  return { container, dom, requests, root, async cleanup() { await act(async () => root.unmount()); dom.window.close(); globalThis.window=previous.window; globalThis.document=previous.document; globalThis.fetch=previous.fetch; Object.defineProperty(globalThis,"navigator",{configurable:true,value:previous.navigator}); } };
}

const button = (container, label) => [...container.querySelectorAll("button")].find((item) => item.textContent.trim() === label);
const click = async (element, dom) => { assert.ok(element); await act(async () => element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }))); };

test("Toronto cafe-day detection recognizes today's Lunch Special activity", () => {
  assert.equal(hasLunchSpecialAnnouncementToday([ordinaryActivity], new Date("2026-08-12T23:59:00Z")), true);
  assert.equal(hasLunchSpecialAnnouncementToday([ordinaryActivity], new Date("2026-08-13T04:01:00Z")), false);
});

test("Owner sees normal first send when today has no Lunch Special announcement", { concurrency: false }, async () => {
  const app=await renderCommunications();try{assert.ok(button(app.container,"Send Lunch Special notification"));assert.equal(button(app.container,"Resend Lunch Special notification"),undefined);}finally{await app.cleanup();}
});

test("Owner confirmed resend uses the explicit override payload once and preserves activity", { concurrency: false }, async () => {
  let confirmations=0;const app=await renderCommunications({activity:[ordinaryActivity],confirm:()=>{confirmations+=1;return true;}});try{assert.equal(button(app.container,"Send Lunch Special notification"),undefined);assert.match(app.container.textContent,/Attempted 4 · Accepted 0 · Failed 1/);const resend=button(app.container,"Resend Lunch Special notification");await act(async()=>{resend.dispatchEvent(new app.dom.window.MouseEvent("click",{bubbles:true,cancelable:true}));resend.dispatchEvent(new app.dom.window.MouseEvent("click",{bubbles:true,cancelable:true}));});await waitForText(app.container,"Owner-confirmed Lunch Special resend queued.");assert.equal(confirmations,1);assert.deepEqual(app.requests,[{kind:"lunch_special",override:true,confirm_override:true}]);}finally{await app.cleanup();}
});

test("Owner cancel sends nothing", { concurrency: false }, async () => {
  const app=await renderCommunications({activity:[ordinaryActivity],confirm:()=>false});try{await click(button(app.container,"Resend Lunch Special notification"),app.dom);assert.deepEqual(app.requests,[]);}finally{await app.cleanup();}
});

test("Staff never sees resend and ordinary duplicate remains an ordinary request", { concurrency: false }, async () => {
  const app=await renderCommunications({activity:[ordinaryActivity],role:"staff"});try{assert.equal(button(app.container,"Resend Lunch Special notification"),undefined);await click(button(app.container,"Send Lunch Special notification"),app.dom);assert.deepEqual(app.requests,[{kind:"lunch_special",override:false,confirm_override:false}]);}finally{await app.cleanup();}
});
